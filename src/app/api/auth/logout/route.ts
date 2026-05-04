/**
 * @fileoverview Route API pour la déconnexion des utilisateurs
 * Invalide le token JWT côté client (stateless)
 */

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Déconnexion d'un utilisateur
 *     description: Déconnecte l'utilisateur (le client doit supprimer le token).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Déconnexion réussie
 */

import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/utils/api-response";
import { extractTokenFromHeader, verifyToken } from "@/lib/auth";
import { blacklistToken } from "@/lib/tokenBlacklist";

/**
 * Handler POST pour la déconnexion d'un utilisateur.
 * Ajoute le token JWT à la blacklist Redis jusqu'à son expiration naturelle,
 * ce qui le rend invalide même s'il n'a pas encore expiré.
 */
export async function POST(request: NextRequest) {
    const authHeader = request.headers.get("Authorization");
    const token = extractTokenFromHeader(authHeader);

    if (token) {
        const payload = await verifyToken(token);
        if (payload && payload.exp) {
            await blacklistToken(token, payload.exp);
        }
    }

    return successResponse("Déconnexion réussie.");
}