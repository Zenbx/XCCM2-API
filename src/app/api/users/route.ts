/**
 * @openapi
 * /api/users:
 *   get:
 *     tags:
 *       - Users
 *     summary: Lister tous les utilisateurs (admin)
 *     description: Retourne la liste complète des utilisateurs avec leurs statistiques. Réservé aux administrateurs.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des utilisateurs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/User'
 *                       - type: object
 *                         properties:
 *                           role:
 *                             type: string
 *                           projectsCount:
 *                             type: integer
 *                           marketplaceCount:
 *                             type: integer
 *       403:
 *         description: Accès refusé (non admin)
 */
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    serverErrorResponse,
    forbiddenResponse
} from "@/utils/api-response";

/**
 * GET /api/users
 * Récupère la liste de tous les utilisateurs (Admin uniquement)
 */
export async function GET(request: NextRequest) {
    try {
        const userRole = request.headers.get("x-user-role");

        // Utilise le header injecté par le middleware pour plus d'efficacité
        if (userRole !== "admin") {
            return forbiddenResponse("Accès refusé. Réservé aux administrateurs.");
        }

        const users = await prisma.user.findMany({
            select: {
                user_id: true,
                firstname: true,
                lastname: true,
                email: true,
                role: true, // Corrigé: 'role' au lieu de 'user_role'
                created_at: true,
                _count: {
                    select: {
                        projects: true,
                        marketplaceItems: true
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        });

        // Mapping pour simplifier la structure pour le frontend
        const safeUsers = users.map((u) => ({
            user_id: u.user_id,
            firstname: u.firstname,
            lastname: u.lastname,
            email: u.email,
            role: u.role,
            created_at: u.created_at,
            projectsCount: u._count?.projects || 0,
            marketplaceCount: u._count?.marketplaceItems || 0,
        }));

        return successResponse("Liste des utilisateurs récupérée", safeUsers);

    } catch (error: any) {
        console.error("Error listing users:", error);
        return serverErrorResponse(
            "Erreur lors de la récupération des utilisateurs",
            error instanceof Error ? error.message : undefined
        );
    }
}
