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
