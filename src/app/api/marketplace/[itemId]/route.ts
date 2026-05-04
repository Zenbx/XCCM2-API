/**
 * @openapi
 * /api/marketplace/{itemId}:
 *   delete:
 *     tags:
 *       - Marketplace
 *     summary: Supprimer un item (vendeur uniquement)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Item retiré de la marketplace
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Pas autorisé à supprimer cet item
 *       404:
 *         description: Item non trouvé
 *   patch:
 *     tags:
 *       - Marketplace
 *     summary: Incrémenter le compteur de téléchargements
 *     description: Appelé quand un utilisateur importe un item. Pas d'authentification requise.
 *     security: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Téléchargement enregistré
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/MarketplaceItem'
 */
/**
 * @fileoverview Route API pour supprimer un item de la marketplace
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    serverErrorResponse,
} from "@/utils/api-response";

/**
 * Handler DELETE pour supprimer un item de la marketplace
 */
type RouteParams = {
    params: Promise<{ itemId: string }>;
};

export async function DELETE(
    request: NextRequest,
    context: RouteParams
) {
    try {
        const userId = request.headers.get("x-user-id");
        const { itemId } = await context.params;

        if (!userId) {
            return errorResponse("Utilisateur non authentifié", undefined, 401);
        }

        const item = await prisma.marketplaceItem.findUnique({
            where: { id: itemId },
        });

        if (!item) {
            return errorResponse("Item non trouvé", undefined, 404);
        }

        if (item.seller_id !== userId) {
            return errorResponse("Vous n'avez pas l'autorisation de supprimer cet item", undefined, 403);
        }

        await prisma.marketplaceItem.delete({
            where: { id: itemId },
        });

        return successResponse("Item retiré de la marketplace avec succès");
    } catch (error) {
        console.error("Erreur DELETE Marketplace Item:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la suppression de l'item",
            error instanceof Error ? error.message : undefined
        );
    }
}

/**
 * Handler PATCH pour incrémenter le compteur de téléchargements
 */
export async function PATCH(
    request: NextRequest,
    context: RouteParams
) {
    try {
        const { itemId } = await context.params;

        const item = await prisma.marketplaceItem.update({
            where: { id: itemId },
            data: {
                downloads: {
                    increment: 1,
                },
            },
        });

        return successResponse("Téléchargement enregistré", item);
    } catch (error) {
        console.error("Erreur PATCH Marketplace Item:", error);
        return serverErrorResponse(
            "Une erreur est survenue",
            error instanceof Error ? error.message : undefined
        );
    }
}
