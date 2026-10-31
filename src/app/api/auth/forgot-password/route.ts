import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import {
    successResponse,
    errorResponse,
    serverErrorResponse,
} from "@/utils/api-response";
import { sendPasswordResetEmail } from "@/services/emailService";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

/**
 * @openapi
 * /api/auth/forgot-password:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Demander la réinitialisation du mot de passe
 *     description: Envoie un email contenant un lien de réinitialisation si l'utilisateur existe. Réponse identique dans tous les cas (anti-énumération).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Demande traitée (toujours, même si email inconnu)
 *       429:
 *         description: Trop de tentatives
 */
export async function POST(request: NextRequest) {
    const ip = getClientIp(request);
    const rl = await rateLimit(`forgot-password:${ip}`, 5, 15 * 60);
    if (!rl.allowed) {
        return errorResponse(
            "Trop de demandes. Réessayez dans 15 minutes.",
            undefined,
            429
        );
    }

    const genericMessage =
        "Si cette adresse est associée à un compte, un courriel de réinitialisation a été envoyé.";

    try {
        const body = await request.json().catch(() => ({}));
        const email =
            typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

        if (!email) {
            return errorResponse("L'email est requis");
        }

        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (user) {
            const resetToken = crypto.randomBytes(20).toString("hex");
            const resetExpires = new Date(Date.now() + 3600000); // 1 heure

            await prisma.user.update({
                where: { email },
                data: {
                    reset_token: resetToken,
                    reset_expires: resetExpires,
                },
            });

            try {
                await sendPasswordResetEmail(email, resetToken);
            } catch (mailError) {
                console.error("Impossible d'envoyer l'email:", mailError);
            }
        }

        return successResponse(genericMessage);
    } catch (error) {
        console.error("Erreur /api/auth/forgot-password:", error);
        return serverErrorResponse(
            "Erreur lors de la demande de réinitialisation",
            error instanceof Error ? error.message : undefined
        );
    }
}
