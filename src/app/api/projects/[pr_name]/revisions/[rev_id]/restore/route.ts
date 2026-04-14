/**
 * @fileoverview Route de restauration d'une révision
 * POST /api/projects/:pr_name/revisions/:rev_id/restore
 * 
 * Stratégie de restauration (non destructive sur les IDs) :
 *   1. Supprime l'arbre complet actuel (Parts → Chapters → Paras → Notions) via Cascade
 *   2. Recrée l'arbre depuis le snapshot en forçant les MÊMES ObjectIds MongoDB
 *      → Les ClassroomProject.doc_id et autres références existantes restent valides
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { cacheService } from "@/services/cache-service";
import {
    successResponse,
    errorResponse,
    notFoundResponse,
    serverErrorResponse,
} from "@/utils/api-response";

type RouteParams = {
    params: Promise<{ pr_name: string; rev_id: string }>;
};

type NotionSnapshot = {
    notion_id: string;
    notion_name: string;
    notion_number: number;
    notion_content: string;
    parent_para: string;
    owner_id: string;
};

type ParagraphSnapshot = {
    para_id: string;
    para_name: string;
    para_number: number;
    para_intro?: string | null;
    parent_chapter: string;
    owner_id: string;
    notions: NotionSnapshot[];
};

type ChapterSnapshot = {
    chapter_id: string;
    chapter_title: string;
    chapter_number: number;
    chapter_intro?: string | null;
    parent_part: string;
    owner_id: string;
    paragraphs: ParagraphSnapshot[];
};

type PartSnapshot = {
    part_id: string;
    part_title: string;
    part_number: number;
    part_intro?: string | null;
    parent_pr: string;
    owner_id: string;
    chapters: ChapterSnapshot[];
};

type Snapshot = {
    project: {
        pr_id: string;
        pr_name: string;
        description?: string | null;
        category?: string | null;
        level?: string | null;
        tags?: string | null;
        author?: string | null;
        language?: string | null;
    };
    structure: PartSnapshot[];
};

/**
 * POST /api/projects/:pr_name/revisions/:rev_id/restore
 */
export async function POST(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Utilisateur non authentifié", undefined, 401);

        const { pr_name: encodedName, rev_id } = await context.params;
        const pr_name = decodeURIComponent(encodedName);

        // Vérifier que l'utilisateur est bien le propriétaire du projet
        const project = await prisma.project.findFirst({
            where: { pr_name, owner_id: userId },
        });
        if (!project) return notFoundResponse("Projet non trouvé ou accès refusé");

        // Récupérer la révision
        const revision = await prisma.projectRevision.findFirst({
            where: { id: rev_id, project_id: project.pr_id },
        });
        if (!revision) return notFoundResponse("Révision non trouvée");

        const snapshot = revision.snapshot as unknown as Snapshot;

        // ── Étape 1 : Supprimer l'arbre actuel (les Parts en cascade effacent tout) ──
        await prisma.part.deleteMany({ where: { parent_pr: project.pr_id } });
        console.log(`🗑️ Arbre actuel du projet ${pr_name} supprimé pour restauration`);

        // ── Étape 2 : Recréer l'arbre depuis le snapshot ──
        // On force les mêmes ObjectIds pour ne pas invalider de références extérieures
        for (const part of snapshot.structure) {
            await prisma.part.create({
                data: {
                    part_id: part.part_id,
                    part_title: part.part_title,
                    part_number: part.part_number,
                    part_intro: part.part_intro ?? null,
                    parent_pr: project.pr_id,
                    owner_id: userId,
                },
            });

            for (const chapter of part.chapters) {
                await prisma.chapter.create({
                    data: {
                        chapter_id: chapter.chapter_id,
                        chapter_title: chapter.chapter_title,
                        chapter_number: chapter.chapter_number,
                        chapter_intro: chapter.chapter_intro ?? null,
                        parent_part: part.part_id,
                        owner_id: userId,
                    },
                });

                for (const para of chapter.paragraphs) {
                    await prisma.paragraph.create({
                        data: {
                            para_id: para.para_id,
                            para_name: para.para_name,
                            para_number: para.para_number,
                            para_intro: para.para_intro ?? null,
                            parent_chapter: chapter.chapter_id,
                            owner_id: userId,
                        },
                    });

                    for (const notion of para.notions) {
                        await prisma.notion.create({
                            data: {
                                notion_id: notion.notion_id,
                                notion_name: notion.notion_name,
                                notion_number: notion.notion_number,
                                notion_content: notion.notion_content,
                                parent_para: para.para_id,
                                owner_id: userId,
                            },
                        });
                    }
                }
            }
        }

        // ── Étape 3 : Mettre à jour les métadonnées du projet depuis le snapshot ──
        await prisma.project.update({
            where: { pr_id: project.pr_id },
            data: {
                description: snapshot.project.description ?? undefined,
                category: snapshot.project.category ?? undefined,
                level: snapshot.project.level ?? undefined,
                tags: snapshot.project.tags ?? undefined,
                author: snapshot.project.author ?? undefined,
                language: snapshot.project.language ?? undefined,
            },
        });

        // ── Étape 4 : Invalider le cache de structure ──
        await cacheService.del(`project:structure:${pr_name}:${userId}`);

        console.log(`✅ Projet ${pr_name} restauré depuis la révision ${rev_id}`);

        return successResponse("Projet restauré avec succès depuis la révision", {
            restored_revision_id: rev_id,
            label: revision.label,
            restored_at: new Date().toISOString(),
        });

    } catch (error) {
        console.error("Erreur lors de la restauration:", error);
        return serverErrorResponse(
            "Erreur lors de la restauration de la révision",
            error instanceof Error ? error.message : undefined
        );
    }
}
