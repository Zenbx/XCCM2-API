/**
 * @fileoverview Route API pour supprimer un élément du coffre-fort
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    serverErrorResponse,
} from "@/utils/api-response";

/**
 * Handler DELETE pour supprimer un élément du coffre-fort
 */
type RouteParams = {
    params: Promise<{ vaultItemId: string }>;
};

export async function DELETE(
    request: NextRequest,
    context: RouteParams
) {
    try {
        const userId = request.headers.get("x-user-id");
        const { vaultItemId } = await context.params;

        if (!userId) {
            return errorResponse("Utilisateur non authentifié", undefined, 401);
        }

        // Vérifier que l'élément appartient bien à l'utilisateur
        const vaultItem = await prisma.vaultItem.findUnique({
            where: { id: vaultItemId },
        });

        if (!vaultItem) {
            return errorResponse("Élément non trouvé", undefined, 404);
        }

        if (vaultItem.owner_id !== userId) {
            return errorResponse("Vous n'avez pas l'autorisation de supprimer cet élément", undefined, 403);
        }

        await prisma.vaultItem.delete({
            where: { id: vaultItemId },
        });

        return successResponse("Élément retiré du coffre-fort avec succès");
    } catch (error) {
        console.error("Erreur DELETE Vault Item:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la suppression de l'élément",
            error instanceof Error ? error.message : undefined
        );
    }
}
