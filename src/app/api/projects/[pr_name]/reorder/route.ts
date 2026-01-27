/**
 * @fileoverview Route API pour réordonner plusieurs granules au sein d'un même parent
 * Résout les problèmes de contrainte unique lors de déplacements multiples
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

type RouteParams = {
    params: Promise<{ pr_name: string }>;
};

interface ReorderRequest {
    type: 'part' | 'chapter' | 'paragraph' | 'notion';
    items: { id: string; number: number }[];
}

/**
 * Handler POST pour réordonner des granules
 * Utilise une stratégie d'offset temporaire pour éviter les conflits de contrainte Unique
 */
export async function POST(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) {
            return errorResponse("Utilisateur non authentifié", undefined, 401);
        }

        const { pr_name: encodedName } = await context.params;
        const pr_name = decodeURIComponent(encodedName);

        // Vérifier l'accès au projet
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
            return notFoundResponse("Projet non trouvé");
        }

        const body: ReorderRequest = await request.json();
        const { type, items } = body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return errorResponse("Liste d'items invalide", undefined, 400);
        }

        console.log(`📦 Reorder Bulk ${type} for ${pr_name} (${items.length} items)`);

        // Exécuter en transaction
        await prisma.$transaction(async (tx) => {
            const TEMP_OFFSET = 10000;

            if (type === 'part') {
                // 1. Décalage temporaire
                for (const item of items) {
                    await tx.part.update({
                        where: { part_id: item.id },
                        data: { part_number: { increment: TEMP_OFFSET } }
                    });
                }
                // 2. Assignation finale
                for (const item of items) {
                    await tx.part.update({
                        where: { part_id: item.id },
                        data: { part_number: item.number }
                    });
                }
            } else if (type === 'chapter') {
                for (const item of items) {
                    await tx.chapter.update({
                        where: { chapter_id: item.id },
                        data: { chapter_number: { increment: TEMP_OFFSET } }
                    });
                }
                for (const item of items) {
                    await tx.chapter.update({
                        where: { chapter_id: item.id },
                        data: { chapter_number: item.number }
                    });
                }
            } else if (type === 'paragraph') {
                for (const item of items) {
                    await tx.paragraph.update({
                        where: { para_id: item.id },
                        data: { para_number: { increment: TEMP_OFFSET } }
                    });
                }
                for (const item of items) {
                    await tx.paragraph.update({
                        where: { para_id: item.id },
                        data: { para_number: item.number }
                    });
                }
            } else if (type === 'notion') {
                for (const item of items) {
                    await tx.notion.update({
                        where: { notion_id: item.id },
                        data: { notion_number: { increment: TEMP_OFFSET } }
                    });
                }
                for (const item of items) {
                    await tx.notion.update({
                        where: { notion_id: item.id },
                        data: { notion_number: item.number }
                    });
                }
            }
        });

        // 📡 Broadcast temps réel
        await realtimeService.broadcastStructureChange(
            pr_name,
            'STRUCTURE_CHANGED',
            {
                type: type,
                action: 'reordered',
                count: items.length
            }
        );

        // 🗑️ Invalider le cache
        await cacheService.invalidateProjectStructure(pr_name);

        return successResponse("Réordonnancement réussi");

    } catch (error) {
        console.error("❌ Erreur critique lors du réordonnancement bulk:", error);
        return serverErrorResponse(
            error instanceof Error ? error.message : undefined
        );
    }
}
