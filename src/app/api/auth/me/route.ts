import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    serverErrorResponse,
} from "@/utils/api-response";

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Récupérer l'utilisateur actuel
 *     description: Retourne les informations de profil de l'utilisateur authentifié par le token JWT.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Utilisateur récupéré
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     user: { $ref: '#/components/schemas/User' }
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

        return successResponse("Utilisateur récupéré", { user });
    } catch (error) {
        console.error("Erreur /api/auth/me:", error);
        return serverErrorResponse(
            "Erreur serveur",
            error instanceof Error ? error.message : undefined
        );
    }
}