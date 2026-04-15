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

import { successResponse } from "@/utils/api-response";

/**
 * Handler POST pour la déconnexion d'un utilisateur
 * Note: Avec JWT stateless, la déconnexion se fait côté client
 * Le client doit simplement supprimer le token du localStorage/cookies
 * @returns Réponse JSON de confirmation
 */
export async function POST() {
    return successResponse(
        "Déconnexion réussie. Veuillez supprimer le token côté client."
    );
}