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
