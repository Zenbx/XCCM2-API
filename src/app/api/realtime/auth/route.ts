/**
 * @openapi
 * /api/realtime/auth:
 *   post:
 *     tags:
 *       - Realtime
 *     summary: Obtenir un token Ably
 *     description: Génère un token temporaire Ably pour que le client se connecte aux channels temps réel.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token Ably généré
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     tokenRequest:
 *                       type: object
 *                       description: Token request Ably à passer au SDK client
 *       401:
 *         description: Non authentifié
 *       500:
 *         description: Erreur génération token
 */
/**
 * @fileoverview Route API pour l'authentification Ably
 * Génère un token temporaire pour que le client se connecte aux channels
 */

import { NextRequest } from "next/server";
import { realtimeService } from "@/services/realtime-service";
import {
    successResponse,
    errorResponse,
    serverErrorResponse,
} from "@/utils/api-response";

/**
 * Handler POST pour générer un token Ably
 */
export async function POST(request: NextRequest) {
    try {
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Utilisateur non authentifié", undefined, 401);
        }

        const tokenRequest = await realtimeService.createClientToken(userId);

        return successResponse("Token Ably généré avec succès", {
            tokenRequest: JSON.parse(tokenRequest),
        });
    } catch (error) {
        console.error("Erreur lors de la génération du token Ably:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la génération du token",
            error instanceof Error ? error.message : undefined
        );
    }
}
