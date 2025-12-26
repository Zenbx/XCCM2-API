/**
 * @fileoverview Route API pour récupérer les informations de l'utilisateur connecté
 * Nécessite un token JWT valide
 *
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Récupérer les informations de l'utilisateur connecté
 *     description: Retourne les informations du profil de l'utilisateur authentifié
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Informations utilisateur récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Utilisateur récupéré avec succès
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: Non autorisé (token manquant ou invalide)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         description: Utilisateur non trouvé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { toPublicUser } from "@/lib/auth";
import {
    successResponse,
    notFoundResponse,
    serverErrorResponse,
} from "@/utils/api-response";
import {headers} from "next/dist/server/request/headers";

/**
 * Handler GET pour récupérer les informations de l'utilisateur connecté
 * Le userId est extrait du token JWT par le middleware et ajouté dans les headers
 * @param request - Requête Next.js avec le header x-user-id
 * @returns Réponse JSON avec les informations de l'utilisateur
 */
export async function GET(request: NextRequest) {
    try {
        // Récupère l'userId depuis le header (ajouté par le middleware)
        const userId = request.headers.get("x-user-id");
        //const headersList = await headers(); // Dans les versions récentes de Next.js, c'est asynchrone
        //const userId = headersList.get('x-user-id');

        if (!userId) {
            return notFoundResponse("Utilisateur non trouvé");
        }

        // Recherche l'utilisateur dans la base de données
        const user = await prisma.user.findUnique({
            where: { user_id: userId },
        });

        if (!user) {
            return notFoundResponse("Utilisateur non trouvé");
        }

        // Convertit en utilisateur public
        const publicUser = toPublicUser(user);

        return successResponse("Utilisateur récupéré avec succès", {
            user: publicUser,
        });
    } catch (error) {
        console.error("Erreur lors de la récupération de l'utilisateur:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la récupération de l'utilisateur",
            error instanceof Error ? error.message : undefined
        );
    }
}