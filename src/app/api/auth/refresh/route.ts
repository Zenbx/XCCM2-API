/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Renouvellement silencieux du token JWT
 *     description: Génère un nouveau token si l'actuel est valide et expire dans moins de 24h.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Nouveau token généré
 *       401:
 *         description: Token invalide ou expiré
 *       425:
 *         description: Token encore valide, pas besoin de refresh
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken, generateToken, toPublicUser, extractTokenFromHeader } from "@/lib/auth";
import { blacklistToken, isTokenBlacklisted } from "@/lib/tokenBlacklist";
import { successResponse, errorResponse, serverErrorResponse } from "@/utils/api-response";

// Refresh uniquement si le token expire dans moins de 24h
const REFRESH_THRESHOLD_SECONDS = 24 * 60 * 60;

export async function POST(request: NextRequest) {
    try {
        const token = extractTokenFromHeader(request.headers.get("Authorization"));
        if (!token) {
            return errorResponse("Token manquant.", undefined, 401);
        }

        const payload = await verifyToken(token);
        if (!payload || !payload.exp) {
            return errorResponse("Token invalide ou expiré.", undefined, 401);
        }

        const revoked = await isTokenBlacklisted(token);
        if (revoked) {
            return errorResponse("Session révoquée. Veuillez vous reconnecter.", undefined, 401);
        }

        const secondsUntilExpiry = payload.exp - Math.floor(Date.now() / 1000);

        // Ne refresh pas un token encore valide longtemps
        if (secondsUntilExpiry > REFRESH_THRESHOLD_SECONDS) {
            return errorResponse("Token encore valide, refresh non nécessaire.", undefined, 425);
        }

        const userId = (payload as any).userId;
        const user = await prisma.user.findUnique({ where: { user_id: userId } });
        if (!user) {
            return errorResponse("Utilisateur introuvable.", undefined, 401);
        }

        // Invalide l'ancien token
        await blacklistToken(token, payload.exp);

        const newToken = await generateToken(toPublicUser(user));

        return successResponse("Token renouvelé.", { token: newToken });
    } catch (error) {
        console.error("Erreur refresh token:", error);
        return serverErrorResponse("Erreur lors du renouvellement du token.");
    }
}
