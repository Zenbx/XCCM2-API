import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    notFoundResponse,
    serverErrorResponse,
    errorResponse,
} from "@/utils/api-response";
import { verifyToken } from "@/lib/auth";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const { userId } = await params;

        const user = await prisma.user.findUnique({
            where: { user_id: userId },
            select: {
                user_id: true,
                firstname: true,
                lastname: true,
                occupation: true,
                org: true,
                created_at: true,
                projects: {
                    where: { is_published: true },
                    select: {
                        pr_id: true,
                        pr_name: true,
                        description: true,
                        category: true,
                        updated_at: true,
                        documents: {
                            select: {
                                consult: true,
                                likes: { select: { id: true } }
                            }
                        }
                    }
                }
            }
        });

        if (!user) {
            return notFoundResponse("Utilisateur non trouvé");
        }

        // Calculate aggregates
        let totalViews = 0;
        let totalLikes = 0;

        const projectsWithStats = user.projects.map(p => {
            let pViews = 0;
            let pLikes = 0;
            p.documents.forEach(d => {
                pViews += d.consult;
                pLikes += d.likes.length;
            });
            totalViews += pViews;
            totalLikes += pLikes;

            return {
                ...p,
                views: pViews,
                likes: pLikes
            };
        });

        const publicProfile = {
            user: {
                id: user.user_id,
                firstname: user.firstname,
                lastname: user.lastname,
                occupation: user.occupation,
                org: user.org,
                memberSince: user.created_at
            },
            stats: {
                totalProjects: user.projects.length,
                totalViews,
                totalLikes
            },
            projects: projectsWithStats
        };

        return successResponse("Profil public récupéré", publicProfile);

    } catch (error) {
        console.error("Erreur récupération profil public:", error);
        return serverErrorResponse(
            "Erreur lors de la récupération du profil",
            error instanceof Error ? error.message : undefined
        );
    }
}

/**
 * DELETE /api/users/[userId]
 * Supprime un utilisateur (Admin uniquement)
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        // Vérifier l'authentification
        const authHeader = request.headers.get("Authorization");
        if (!authHeader) return errorResponse("Authentification requise", undefined, 401);

        const token = authHeader.split(" ")[1];
        const payload = await verifyToken(token);
        if (!payload) return errorResponse("Token invalide", undefined, 401);

        // Vérifier que c'est un admin
        const requestor = await prisma.user.findUnique({ where: { user_id: payload.userId } });
        if (!requestor || requestor.user_role !== 'ADMIN') {
            return errorResponse("Accès refusé. Réservé aux administrateurs.", undefined, 403);
        }

        const { userId } = await params;

        // Ne pas permettre de se supprimer soi-même
        if (userId === payload.userId) {
            return errorResponse("Vous ne pouvez pas supprimer votre propre compte", undefined, 400);
        }

        // Vérifier que l'utilisateur existe
        const user = await prisma.user.findUnique({
            where: { user_id: userId }
        });

        if (!user) {
            return notFoundResponse("Utilisateur non trouvé");
        }

        // Supprimer l'utilisateur (cascade sur les projets, invitations, etc.)
        await prisma.user.delete({
            where: { user_id: userId }
        });

        return successResponse("Utilisateur supprimé avec succès", null, 200);

    } catch (error) {
        console.error("Erreur suppression utilisateur:", error);
        return serverErrorResponse(
            "Erreur lors de la suppression de l'utilisateur",
            error instanceof Error ? error.message : undefined
        );
    }
}

/**
 * PATCH /api/users/[userId]
 * Modifie le rôle d'un utilisateur (Admin uniquement)
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        // Vérifier l'authentification
        const authHeader = request.headers.get("Authorization");
        if (!authHeader) return errorResponse("Authentification requise", undefined, 401);

        const token = authHeader.split(" ")[1];
        const payload = await verifyToken(token);
        if (!payload) return errorResponse("Token invalide", undefined, 401);

        // Vérifier que c'est un admin
        const requestor = await prisma.user.findUnique({ where: { user_id: payload.userId } });
        if (!requestor || requestor.user_role !== 'ADMIN') {
            return errorResponse("Accès refusé. Réservé aux administrateurs.", undefined, 403);
        }

        const { userId } = await params;
        const body = await request.json();
        const { user_role } = body;

        // Valider le rôle
        if (!user_role || !['USER', 'ADMIN', 'EDITOR'].includes(user_role)) {
            return errorResponse("Rôle invalide. Doit être USER, ADMIN ou EDITOR", undefined, 400);
        }

        // Ne pas permettre de modifier son propre rôle
        if (userId === payload.userId) {
            return errorResponse("Vous ne pouvez pas modifier votre propre rôle", undefined, 400);
        }

        // Vérifier que l'utilisateur existe
        const user = await prisma.user.findUnique({
            where: { user_id: userId }
        });

        if (!user) {
            return notFoundResponse("Utilisateur non trouvé");
        }

        // Mettre à jour le rôle
        const updatedUser = await prisma.user.update({
            where: { user_id: userId },
            data: { user_role },
            select: {
                user_id: true,
                email: true,
                firstname: true,
                lastname: true,
                user_role: true
            }
        });

        return successResponse("Rôle de l'utilisateur mis à jour avec succès", { user: updatedUser }, 200);

    } catch (error) {
        console.error("Erreur modification utilisateur:", error);
        return serverErrorResponse(
            "Erreur lors de la modification de l'utilisateur",
            error instanceof Error ? error.message : undefined
        );
    }
}
