/**
 * @fileoverview Route API pour deplacer un granule vers un nouveau parent
 * Permet de changer le parent d'un Chapter, Paragraph ou Notion
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    notFoundResponse,
    serverErrorResponse,
} from "@/utils/api-response";

type RouteParams = {
    params: Promise<{ pr_name: string }>;
};

interface MoveRequest {
    type: 'chapter' | 'paragraph' | 'notion';
    itemId: string;
    newParentId: string;
    newNumber?: number;
}

/**
 * Handler PATCH pour deplacer un granule vers un nouveau parent
 */
export async function PATCH(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) {
            return errorResponse("Utilisateur non authentifie", undefined, 401);
        }

        const { pr_name: encodedName } = await context.params;
        const pr_name = decodeURIComponent(encodedName);

        // Verifier que le projet appartient a l'utilisateur ou qu'il y est invite
        const project = await prisma.project.findFirst({
            where: {
                pr_name: pr_name,
                OR: [
                    { owner_id: userId },
                    {
                        invitations: {
                            some: {
                                guest_id: userId,
                                invitation_state: "Accepted"
                            }
                        }
                    }
                ]
            },
        });

        if (!project) {
            return notFoundResponse("Projet non trouve");
        }

        const body: MoveRequest = await request.json();
        const { type, itemId, newParentId, newNumber } = body;

        console.log(`🔄 Deplacement ${type}: ${itemId} -> nouveau parent: ${newParentId}`);

        if (type === 'chapter') {
            // Deplacer un chapitre vers une nouvelle partie
            const chapter = await prisma.chapter.findUnique({
                where: { chapter_id: itemId },
                include: { part: true },
            });

            if (!chapter) {
                return notFoundResponse("Chapitre non trouve");
            }

            // Verifier que la nouvelle partie appartient au meme projet
            const newPart = await prisma.part.findUnique({
                where: { part_id: newParentId },
            });

            if (!newPart || newPart.parent_pr !== project.pr_id) {
                return errorResponse("Partie cible invalide", undefined, 400);
            }

            // Calculer le nouveau numero si non fourni
            let targetNumber = newNumber;
            if (!targetNumber) {
                const maxChapter = await prisma.chapter.aggregate({
                    where: { parent_part: newParentId },
                    _max: { chapter_number: true },
                });
                targetNumber = (maxChapter._max.chapter_number || 0) + 1;
            }

            // Mettre a jour le chapitre
            const updated = await prisma.chapter.update({
                where: { chapter_id: itemId },
                data: {
                    parent_part: newParentId,
                    chapter_number: targetNumber,
                },
            });

            return successResponse("Chapitre deplace avec succes", { chapter: updated });

        } else if (type === 'paragraph') {
            // Deplacer un paragraphe vers un nouveau chapitre
            const paragraph = await prisma.paragraph.findUnique({
                where: { para_id: itemId },
            });

            if (!paragraph) {
                return notFoundResponse("Paragraphe non trouve");
            }

            // Verifier que le nouveau chapitre appartient au meme projet
            const newChapter = await prisma.chapter.findUnique({
                where: { chapter_id: newParentId },
                include: { part: true },
            });

            if (!newChapter || newChapter.part.parent_pr !== project.pr_id) {
                return errorResponse("Chapitre cible invalide", undefined, 400);
            }

            // Calculer le nouveau numero si non fourni
            let targetNumber = newNumber;
            if (!targetNumber) {
                const maxPara = await prisma.paragraph.aggregate({
                    where: { parent_chapter: newParentId },
                    _max: { para_number: true },
                });
                targetNumber = (maxPara._max.para_number || 0) + 1;
            }

            // Mettre a jour le paragraphe
            const updated = await prisma.paragraph.update({
                where: { para_id: itemId },
                data: {
                    parent_chapter: newParentId,
                    para_number: targetNumber,
                },
            });

            return successResponse("Paragraphe deplace avec succes", { paragraph: updated });

        } else if (type === 'notion') {
            // Deplacer une notion vers un nouveau paragraphe
            const notion = await prisma.notion.findUnique({
                where: { notion_id: itemId },
            });

            if (!notion) {
                return notFoundResponse("Notion non trouvee");
            }

            // Verifier que le nouveau paragraphe appartient au meme projet
            const newParagraph = await prisma.paragraph.findUnique({
                where: { para_id: newParentId },
                include: {
                    chapter: {
                        include: { part: true },
                    },
                },
            });

            if (!newParagraph || newParagraph.chapter.part.parent_pr !== project.pr_id) {
                return errorResponse("Paragraphe cible invalide", undefined, 400);
            }

            // Calculer le nouveau numero si non fourni
            let targetNumber = newNumber;
            if (!targetNumber) {
                const maxNotion = await prisma.notion.aggregate({
                    where: { parent_para: newParentId },
                    _max: { notion_number: true },
                });
                targetNumber = (maxNotion._max.notion_number || 0) + 1;
            }

            // Mettre a jour la notion
            const updated = await prisma.notion.update({
                where: { notion_id: itemId },
                data: {
                    parent_para: newParentId,
                    notion_number: targetNumber,
                },
            });

            return successResponse("Notion deplacee avec succes", { notion: updated });

        } else {
            return errorResponse("Type de granule invalide", undefined, 400);
        }

    } catch (error) {
        console.error("Erreur lors du deplacement:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors du deplacement",
            error instanceof Error ? error.message : undefined
        );
    }
}
