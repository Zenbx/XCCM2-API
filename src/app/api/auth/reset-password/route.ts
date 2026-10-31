import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import {
    successResponse,
    errorResponse,
    serverErrorResponse,
    forbiddenResponse,
} from "@/utils/api-response";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

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
 *       429:
 *         description: Trop de tentatives
 */
export async function POST(request: NextRequest) {
    const ip = getClientIp(request);
    const rl = await rateLimit(`reset-password:${ip}`, 10, 15 * 60);
    if (!rl.allowed) {
        return errorResponse(
            "Trop de tentatives. Réessayez dans 15 minutes.",
            undefined,
            429
        );
    }

    try {
        const { token, password } = await request.json();

        if (!token || !password) {
            return errorResponse("Token et mot de passe sont requis");
        }

        if (typeof password !== "string" || password.length < 8) {
            return errorResponse(
                "Le mot de passe doit contenir au moins 8 caractères"
            );
        }

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

        const hashedPassword = await hashPassword(password);

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
