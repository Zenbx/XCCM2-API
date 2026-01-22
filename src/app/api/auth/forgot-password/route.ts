import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import {
    successResponse,
    errorResponse,
    serverErrorResponse,
    notFoundResponse,
} from "@/utils/api-response";

/**
 * POST /api/auth/forgot-password
 * Demande de réinitialisation de mot de passe
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

        // NOTE: En production, on enverrait un email ici.
        // Pour le test, on renvoie le token pour pouvoir l'utiliser côté front.
        return successResponse("Un email de récupération a été simulé", {
            resetToken, // À retirer en production
            email,
        });
    } catch (error) {
        console.error("Erreur /api/auth/forgot-password:", error);
        return serverErrorResponse(
            "Erreur lors de la demande de réinitialisation",
            error instanceof Error ? error.message : undefined
        );
    }
}
