import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    serverErrorResponse,
} from "@/utils/api-response";

/**
 * GET /api/auth/me
 * Récupère les informations de l'utilisateur connecté
 */
export async function GET(request: NextRequest) {
    try {
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Non authentifié", undefined, 401);
        }

        const user = await prisma.user.findUnique({
            where: { user_id: userId },
            select: {
                user_id: true,
                firstname: true,
                lastname: true,
                email: true,
                role: true,
                created_at: true,
            },
        });

        if (!user) {
            return errorResponse("Utilisateur non trouvé", undefined, 404);
        }

        return successResponse("Utilisateur récupéré", user);
    } catch (error) {
        console.error("Erreur /api/auth/me:", error);
        return serverErrorResponse(
            "Erreur serveur",
            error instanceof Error ? error.message : undefined
        );
    }
}