import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import {
    successResponse,
    errorResponse,
    serverErrorResponse,
    forbiddenResponse,
} from "@/utils/api-response";

/**
 * @openapi
 * /api/auth/reset-password:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Réinitialiser le mot de passe
 *     description: Met à jour le mot de passe en utilisant le token de réinitialisation reçu par email.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token: { type: string }
 *               password: { type: string, format: password }
 *     responses:
 *       200:
 *         description: Mot de passe réinitialisé
 *       403:
 *         description: Token invalide ou expiré
 */
export async function POST(request: NextRequest) {
    try {
        const { token, password } = await request.json();

        if (!token || !password) {
            return errorResponse("Token et mot de passe sont requis");
        }

        // Trouve l'utilisateur avec ce token non expiré
        const user = await prisma.user.findFirst({
            where: {
                reset_token: token,
                reset_expires: {
                    gt: new Date(),
                },
            },
        });

        if (!user) {
            return forbiddenResponse("Token invalide ou expiré");
        }

        // Hache le nouveau mot de passe
        const hashedPassword = await hashPassword(password);

        // Met à jour l'utilisateur et efface le token
        await prisma.user.update({
            where: { user_id: user.user_id },
            data: {
                password: hashedPassword,
                reset_token: null,
                reset_expires: null,
            },
        });

        return successResponse("Mot de passe réinitialisé avec succès");
    } catch (error) {
        console.error("Erreur /api/auth/reset-password:", error);
        return serverErrorResponse(
            "Erreur lors de la réinitialisation",
            error instanceof Error ? error.message : undefined
        );
    }
}
