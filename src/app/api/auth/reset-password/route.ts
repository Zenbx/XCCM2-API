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
 * POST /api/auth/reset-password
 * Réinitialisation du mot de passe avec un token
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
