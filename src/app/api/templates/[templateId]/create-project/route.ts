/**
 * POST /api/templates/[templateId]/create-project
 * Créer un nouveau projet à partir d'un template
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ templateId: string }> }
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

        const { templateId } = await params;
        const body = await req.json();
        const { pr_name } = body;

        if (!pr_name) {
            return NextResponse.json(
                { success: false, message: 'Le nom du projet est requis' },
                { status: 400 }
            );
        }

        // Récupérer le template
        const template = await prisma.template.findUnique({
            where: { template_id: templateId },
        });

        if (!template) {
            return NextResponse.json(
                { success: false, message: 'Template non trouvé' },
                { status: 404 }
            );
        }

        // Incrémenter le compteur d'utilisation
        await prisma.template.update({
            where: { template_id: templateId },
            data: { usage_count: { increment: 1 } },
        });

        // Créer le projet
        const project = await prisma.project.create({
            data: {
                pr_name,
                owner_id: payload.userId,
                description: template.description,
                category: template.category,
            },
        });

        // Créer la structure depuis le template
        const structure = template.structure as any;

        if (structure && structure.parts && Array.isArray(structure.parts)) {
            for (const partData of structure.parts) {
                const part = await prisma.part.create({
                    data: {
                        part_title: partData.part_title,
                        part_number: partData.part_number,
                        part_intro: partData.part_intro || '',
                        parent_pr: project.pr_id,
                        owner_id: payload.userId,
                    },
                });

                if (partData.chapters && Array.isArray(partData.chapters)) {
                    for (const chapterData of partData.chapters) {
                        const chapter = await prisma.chapter.create({
                            data: {
                                chapter_title: chapterData.chapter_title,
                                chapter_number: chapterData.chapter_number,
                                parent_part: part.part_id,
                                owner_id: payload.userId,
                            },
                        });

                        if (chapterData.paragraphs && Array.isArray(chapterData.paragraphs)) {
                            for (const paragraphData of chapterData.paragraphs) {
                                const paragraph = await prisma.paragraph.create({
                                    data: {
                                        para_name: paragraphData.para_name,
                                        para_number: paragraphData.para_number,
                                        parent_chapter: chapter.chapter_id,
                                        owner_id: payload.userId,
                                    },
                                });

                                if (paragraphData.notions && Array.isArray(paragraphData.notions)) {
                                    for (const notionData of paragraphData.notions) {
                                        await prisma.notion.create({
                                            data: {
                                                notion_name: notionData.notion_name,
                                                notion_number: notionData.notion_number,
                                                notion_content: notionData.notion_content || '',
                                                parent_para: paragraph.para_id,
                                                owner_id: payload.userId,
                                            },
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Projet créé avec succès depuis le template',
            data: { project },
        });
    } catch (error: any) {
        console.error('Error creating project from template:', error);
        return NextResponse.json(
            {
                success: false,
                message: 'Erreur lors de la création du projet',
                error: error.message,
            },
            { status: 500 }
        );
    }
}
