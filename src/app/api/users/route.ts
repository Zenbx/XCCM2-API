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
