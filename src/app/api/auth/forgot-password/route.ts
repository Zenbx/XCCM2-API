import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import {
    successResponse,
    errorResponse,
    serverErrorResponse,
    notFoundResponse,
} from "@/utils/api-response";
import { sendPasswordResetEmail } from "@/services/emailService";

/**
 * @openapi
 * /api/auth/forgot-password:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Demander la réinitialisation du mot de passe
 *     description: Envoie un email contenant un lien de réinitialisation si l'utilisateur existe.
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
 *         description: Demande traitée
 *       404:
 *         description: Utilisateur non trouvé
 */
export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json();

        if (!email) {
            return errorResponse("L'email est requis");
        }

        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            // Pour des raisons de sécurité, on peut renvoyer un succès même si l'user n'existe pas
            // Mais ici on va être explicite pour faciliter le test
            return notFoundResponse("Aucun utilisateur avec cet email");
        }

        // Génère un token aléatoire (6 caractères pour la simplicité du test ou long format)
        const resetToken = crypto.randomBytes(20).toString('hex');
        const resetExpires = new Date(Date.now() + 3600000); // 1 heure

        await prisma.user.update({
            where: { email },
            data: {
                reset_token: resetToken,
                reset_expires: resetExpires,
            },
        });

        // Envoi de l'email avec lien de reset
        try {
            await sendPasswordResetEmail(email, resetToken);
        } catch (mailError) {
             console.error("Impossible d'envoyer l'email:", mailError);
             // On ne donne pas d'erreur 500 stricte car le token est généré, 
             // mais c'est bien de logger e.g. si mauvais identifiants SMTP.
        }

        // On ne renvoie JAMAIS le token en production !
        return successResponse("Un courriel avec les instructions de réinitialisation a été envoyé si l'adresse est associée à un compte.");
    } catch (error) {
        console.error("Erreur /api/auth/forgot-password:", error);
        return serverErrorResponse(
            "Erreur lors de la demande de réinitialisation",
            error instanceof Error ? error.message : undefined
        );
    }
}
