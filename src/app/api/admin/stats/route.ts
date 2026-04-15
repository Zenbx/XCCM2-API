import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    serverErrorResponse,
} from "@/utils/api-response";

/**
 * @openapi
 * /api/admin/stats:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Statistiques globales (Admin)
 *     description: Récupère les compteurs globaux (utilisateurs, projets, documents) et l'activité récente.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiques récupérées
 *       403:
 *         description: Accès refusé (non-admin)
 */
export async function GET(request: NextRequest) {
    try {
        const userRole = request.headers.get("x-user-role");

        if (userRole?.toLowerCase() !== "admin") {
            return errorResponse("Accès refusé", undefined, 403);
        }

        // Statistiques globales en parallèle
        const [
            totalUsers,
            totalProjects,
            totalDocuments,
            totalLikes,
            totalComments,
            recentUsers,
            recentProjects,
        ] = await Promise.all([
            prisma.user.count(),
            prisma.project.count(),
            prisma.document.count(),
            prisma.like.count(),
            prisma.comment.count(),
            prisma.user.findMany({
                orderBy: { created_at: "desc" },
                take: 5,
                select: {
                    user_id: true,
                    firstname: true,
                    lastname: true,
                    email: true,
                    created_at: true,
                },
            }),
            prisma.project.findMany({
                orderBy: { created_at: "desc" },
                take: 5,
                include: {
                    owner: {
                        select: {
                            firstname: true,
                            lastname: true,
                        },
                    },
                },
            }),
        ]);

        // Statistiques utilisateurs avec leurs projets et documents
        const usersWithCounts = await prisma.user.findMany({
            select: {
                user_id: true,
                firstname: true,
                lastname: true,
                email: true,
                role: true,
                created_at: true,
                _count: {
                    select: {
                        projects: true,
                    },
                },
            },
        });

        // Pour chaque utilisateur, compter ses documents publiés
        const usersWithStats = await Promise.all(
            usersWithCounts.map(async (user) => {
                const documentsCount = await prisma.document.count({
                    where: {
                        project: {
                            owner_id: user.user_id,
                        },
                    },
                });

                return {
                    user_id: user.user_id,
                    firstname: user.firstname,
                    lastname: user.lastname,
                    email: user.email,
                    role: user.role,
                    created_at: user.created_at,
                    projectsCount: user._count.projects,
                    marketplaceCount: documentsCount,
                };
            })
        );

        return successResponse("Statistiques récupérées avec succès", {
            global: {
                totalUsers,
                totalProjects,
                totalDocuments,
                totalLikes,
                totalComments,
            },
            recentUsers,
            recentProjects,
            users: usersWithStats,
        });
    } catch (error) {
        console.error("Erreur /api/admin/stats:", error);
        return serverErrorResponse(
            "Erreur serveur",
            error instanceof Error ? error.message : undefined
        );
    }
}
