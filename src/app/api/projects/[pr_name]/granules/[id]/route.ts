/**
 * @fileoverview Route API unifiée pour les opérations PATCH/DELETE par UUID
 * Détecte automatiquement le type de granule et effectue l'opération demandée.
 * 
 * Avantage: Immunisé aux renommages car l'UUID est stable.
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { realtimeService } from "@/services/realtime-service";
import { cacheService } from "@/services/cache-service";
import {
    successResponse,
    errorResponse,
    notFoundResponse,
    serverErrorResponse,
} from "@/utils/api-response";
import {
    renumberPartsAfterDelete,
    renumberChaptersAfterDelete,
    renumberParagraphsAfterDelete,
    renumberNotionsAfterDelete,
} from "@/utils/granule-helpers";

type RouteParams = {
    params: Promise<{ pr_name: string; id: string }>;
};

// ✅ Détecte le type de granule à partir de son UUID
async function findGranuleById(id: string) {
    // Cherche dans chaque table en parallèle
    const [part, chapter, paragraph, notion] = await Promise.all([
        prisma.part.findUnique({ where: { part_id: id } }),
        prisma.chapter.findUnique({ where: { chapter_id: id } }),
        prisma.paragraph.findUnique({ where: { para_id: id } }),
        prisma.notion.findUnique({ where: { notion_id: id } }),
    ]);

    if (part) return { type: 'part' as const, data: part };
    if (chapter) return { type: 'chapter' as const, data: chapter };
    if (paragraph) return { type: 'paragraph' as const, data: paragraph };
    if (notion) return { type: 'notion' as const, data: notion };
    return null;
}

/**
 * @openapi
 * /api/projects/{pr_name}/granules/{id}:
 *   patch:
 *     tags:
 *       - Projects
 *     summary: Modifier un granule par UUID
 *     description: Met à jour n'importe quel type de granule (Part, Chapter, Paragraph, Notion) via son identifiant unique global.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pr_name
 *         required: true
 *       - in: path
 *         name: id
 *         required: true
 *         description: UUID du granule (MongoDB ObjectId)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GranuleUpdate'
 *     responses:
 *       200:
 *         description: Modification réussie
 */
export async function PATCH(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Utilisateur non authentifié", undefined, 401);

        const { pr_name: encodedPrName, id } = await context.params;
        const pr_name = decodeURIComponent(encodedPrName).trim();

        // Vérifier l'accès au projet
        const project = await prisma.project.findFirst({
            where: {
                pr_name,
                OR: [
                    { owner_id: userId },
                    { invitations: { some: { guest_id: userId, invitation_state: "Accepted" } } }
                ]
            },
        });
        if (!project) return notFoundResponse("Projet non trouvé");

        // Trouver le granule
        const granule = await findGranuleById(id);
        if (!granule) return notFoundResponse("Granule non trouvé");

        const body = await request.json();

        let updated;
        switch (granule.type) {
            case 'part':
                updated = await prisma.part.update({
                    where: { part_id: id },
                    data: {
                        ...(body.part_title && { part_title: body.part_title }),
                        ...(body.part_intro !== undefined && { part_intro: body.part_intro }),
                        ...(body.part_number && { part_number: body.part_number }),
                    },
                });
                break;

            case 'chapter':
                updated = await prisma.chapter.update({
                    where: { chapter_id: id },
                    data: {
                        ...(body.chapter_title && { chapter_title: body.chapter_title }),
                        ...(body.chapter_intro !== undefined && { chapter_intro: body.chapter_intro }),
                        ...(body.chapter_number && { chapter_number: body.chapter_number }),
                    },
                });
                break;

            case 'paragraph':
                updated = await prisma.paragraph.update({
                    where: { para_id: id },
                    data: {
                        ...(body.para_name && { para_name: body.para_name }),
                        ...(body.para_intro !== undefined && { para_intro: body.para_intro }),
                        ...(body.para_number && { para_number: body.para_number }),
                    },
                });
                break;

            case 'notion':
                updated = await prisma.notion.update({
                    where: { notion_id: id },
                    data: {
                        ...(body.notion_name && { notion_name: body.notion_name }),
                        ...(body.notion_content !== undefined && { notion_content: body.notion_content }),
                        ...(body.notion_number && { notion_number: body.notion_number }),
                    },
                });
                break;
        }

        // Broadcast & Cache
        await realtimeService.broadcastStructureChange(pr_name, 'STRUCTURE_CHANGED', {
            type: granule.type, action: 'updated', id
        });
        await cacheService.invalidateProjectStructure(pr_name);

        return successResponse(`${granule.type} modifié(e) avec succès`, { [granule.type]: updated });

    } catch (error) {
        console.error("[granules/PATCH] Error:", error);
        return serverErrorResponse("Erreur lors de la modification", error instanceof Error ? error.message : undefined);
    }
}

/**
 * @openapi
 * /api/projects/{pr_name}/granules/{id}:
 *   delete:
 *     tags:
 *       - Projects
 *     summary: Supprimer un granule par UUID
 *     description: Supprime n'importe quel type de granule et renumérote automatiquement ses frères.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pr_name
 *         required: true
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Suppression réussie
 */
export async function DELETE(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Utilisateur non authentifié", undefined, 401);

        const { pr_name: encodedPrName, id } = await context.params;
        const pr_name = decodeURIComponent(encodedPrName).trim();

        // Vérifier l'accès
        const project = await prisma.project.findFirst({
            where: {
                pr_name,
                OR: [
                    { owner_id: userId },
                    { invitations: { some: { guest_id: userId, invitation_state: "Accepted" } } }
                ]
            },
        });
        if (!project) return notFoundResponse("Projet non trouvé");

        const granule = await findGranuleById(id);
        if (!granule) return notFoundResponse("Granule non trouvé");

        switch (granule.type) {
            case 'part':
                await prisma.part.delete({ where: { part_id: id } });
                if (granule.data.part_number !== null) {
                    await renumberPartsAfterDelete(granule.data.parent_pr, granule.data.part_number);
                }
                break;

            case 'chapter':
                await prisma.chapter.delete({ where: { chapter_id: id } });
                if (granule.data.chapter_number !== null) {
                    await renumberChaptersAfterDelete(granule.data.parent_part, granule.data.chapter_number);
                }
                break;

            case 'paragraph':
                await prisma.paragraph.delete({ where: { para_id: id } });
                if (granule.data.para_number !== null) {
                    await renumberParagraphsAfterDelete(granule.data.parent_chapter, granule.data.para_number);
                }
                break;

            case 'notion':
                await prisma.notion.delete({ where: { notion_id: id } });
                if (granule.data.notion_number !== null) {
                    await renumberNotionsAfterDelete(granule.data.parent_para, granule.data.notion_number);
                }
                break;
        }

        // Broadcast & Cache
        await realtimeService.broadcastStructureChange(pr_name, 'STRUCTURE_CHANGED', {
            type: granule.type, action: 'deleted', id
        });
        await cacheService.invalidateProjectStructure(pr_name);

        return successResponse(`${granule.type} supprimé(e) avec succès`);

    } catch (error) {
        console.error("[granules/DELETE] Error:", error);
        return serverErrorResponse("Erreur lors de la suppression", error instanceof Error ? error.message : undefined);
    }
}
