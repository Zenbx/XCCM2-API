import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    serverErrorResponse,
} from "@/utils/api-response";

/**
 * GET /api/user/settings
 * Récupère les préférences de l'utilisateur
 */
export async function GET(request: NextRequest) {
    try {
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Non authentifié", undefined, 401);
        }

        const user = await prisma.user.findUnique({
            where: { user_id: userId },
            select: { settings: true }
        });

        if (!user) {
            return errorResponse("Utilisateur non trouvé", undefined, 404);
        }

        return successResponse("Paramètres récupérés", { settings: user.settings || {} });
    } catch (error) {
        console.error("Erreur GET /api/user/settings:", error);
        return serverErrorResponse("Erreur serveur", error instanceof Error ? error.message : undefined);
    }
}

/**
 * PUT /api/user/settings
 * Sauvegarde les préférences de l'utilisateur
 */
export async function PUT(request: NextRequest) {
    try {
        const userId = request.headers.get("x-user-id");
        const body = await request.json();

        if (!userId) {
            return errorResponse("Non authentifié", undefined, 401);
        }

        const updatedUser = await prisma.user.update({
            where: { user_id: userId },
            data: { settings: body }
        });

        return successResponse("Paramètres mis à jour", { settings: updatedUser.settings });
    } catch (error) {
        console.error("Erreur PUT /api/user/settings:", error);
        return serverErrorResponse("Erreur serveur", error instanceof Error ? error.message : undefined);
    }
}
