import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    serverErrorResponse,
} from "@/utils/api-response";

/**
 * DELETE /api/user/account
 * Supprime le compte de l'utilisateur
 */
export async function DELETE(request: NextRequest) {
    try {
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Non authentifié", undefined, 401);
        }

        // Suppression de l'utilisateur (Prisma cascade onDelete gérera le reste si configuré)
        // Note: MongoDB avec Prisma ne supporte pas toujours parfaitement le cascade au niveau DB, 
        // mais ici on se contente de supprimer le User principal.
        await prisma.user.delete({
            where: { user_id: userId },
        });

        return successResponse("Compte supprimé avec succès");
    } catch (error) {
        console.error("Erreur DELETE /api/user/account:", error);
        return serverErrorResponse("Erreur serveur", error instanceof Error ? error.message : undefined);
    }
}
