/**
 * @openapi
 * /api/user/password:
 *   put:
 *     tags:
 *       - User
 *     summary: Changer son mot de passe
 *     description: Vérifie l'ancien mot de passe et remplace par le nouveau (bcrypt 10 rounds).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Mot de passe modifié avec succès
 *       400:
 *         description: Mot de passe actuel incorrect ou informations manquantes
 *       401:
 *         description: Non authentifié
 *       404:
 *         description: Utilisateur non trouvé
 */
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
    successResponse,
    errorResponse,
    serverErrorResponse,
} from "@/utils/api-response";

/**
 * PUT /api/user/password
 * Change le mot de passe de l'utilisateur
 */
export async function PUT(request: NextRequest) {
    try {
        const userId = request.headers.get("x-user-id");
        const { currentPassword, newPassword } = await request.json();

        if (!userId) {
            return errorResponse("Non authentifié", undefined, 401);
        }

        if (!currentPassword || !newPassword) {
            return errorResponse("Informations manquantes", undefined, 400);
        }

        // 1. Récupérer l'utilisateur
        const user = await prisma.user.findUnique({
            where: { user_id: userId },
        });

        if (!user || !user.password) {
            return errorResponse("Utilisateur non trouvé", undefined, 404);
        }

        // 2. Vérifier l'ancien mot de passe
        const isPasswordCorrect = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordCorrect) {
            return errorResponse("Mot de passe actuel incorrect", undefined, 400);
        }

        // 3. Hasher le nouveau mot de passe
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // 4. Mettre à jour
        await prisma.user.update({
            where: { user_id: userId },
            data: { password: hashedPassword },
        });

        return successResponse("Mot de passe modifié avec succès");
    } catch (error) {
        console.error("Erreur PUT /api/user/password:", error);
        return serverErrorResponse("Erreur serveur", error instanceof Error ? error.message : undefined);
    }
}
