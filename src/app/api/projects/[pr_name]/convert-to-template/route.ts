/**
 * POST /api/projects/[pr_name]/convert-to-template
 * Convertir un projet existant en template
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ pr_name: string }> }
) {
    try {
        const authHeader = req.headers.get("Authorization");
        const token = extractTokenFromHeader(authHeader);
        const payload = token ? await verifyToken(token) : null;

        if (!payload) {
            return NextResponse.json(
                { success: false, message: 'Non authentifié' },
                { status: 401 }
            );
        }

        const { pr_name: raw_pr_name } = await params;
        const pr_name = decodeURIComponent(raw_pr_name);
        const body = await req.json();
        const { template_name, description, category, is_public = true } = body;

        if (!template_name) {
            return NextResponse.json(
                { success: false, message: 'Le nom du template est requis' },
                { status: 400 }
            );
        }

        // Vérifier que le projet existe et appartient à l'utilisateur
        const project = await prisma.project.findFirst({
            where: {
                pr_name,
                owner_id: payload.userId,
            },
            include: {
                parts: {
                    include: {
                        chapters: {
                            include: {
                                paragraphs: {
                                    include: {
                                        notions: true,
                                    },
                                },
                            },
                        },
                    },
                    orderBy: { part_number: 'asc' },
                },
            },
        });

        if (!project) {
            return NextResponse.json(
                { success: false, message: 'Projet non trouvé ou non autorisé' },
                { status: 404 }
            );
        }

        // Construire la structure du template
        const templateStructure = {
            parts: project.parts.map((part) => ({
                part_title: part.part_title,
                part_number: part.part_number,
                part_intro: part.part_intro || '',
                chapters: part.chapters
                    .sort((a, b) => a.chapter_number - b.chapter_number)
                    .map((chapter) => ({
                        chapter_title: chapter.chapter_title,
                        chapter_number: chapter.chapter_number,
                        paragraphs: chapter.paragraphs
                            .sort((a, b) => a.para_number - b.para_number)
                            .map((paragraph) => ({
                                para_name: paragraph.para_name,
                                para_number: paragraph.para_number,
                                notions: paragraph.notions
                                    .sort((a, b) => a.notion_number - b.notion_number)
                                    .map((notion) => ({
                                        notion_name: notion.notion_name,
                                        notion_number: notion.notion_number,
                                        notion_content: '', // On ne copie pas le contenu pour les templates
                                    })),
                            })),
                    })),
            })),
        };

        // Créer le template
        const template = await prisma.template.create({
            data: {
                template_name,
                description: description || project.description,
                category: category || project.category,
                is_public,
                structure: templateStructure as any,
                creator_id: payload.userId,
                usage_count: 0,
            },
            include: {
                creator: {
                    select: {
                        user_id: true,
                        firstname: true,
                        lastname: true,
                        email: true,
                    },
                },
            },
        });

        return NextResponse.json({
            success: true,
            message: 'Template créé avec succès depuis le projet',
            data: { template },
        });
    } catch (error: any) {
        console.error('Error converting project to template:', error);

        // Gestion de l'erreur de nom unique
        if (error.code === 'P2002') {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Un template avec ce nom existe déjà',
                },
                { status: 409 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                message: 'Erreur lors de la conversion du projet en template',
                error: error.message,
            },
            { status: 500 }
        );
    }
}
