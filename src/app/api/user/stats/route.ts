/**
 * @fileoverview Route API pour récupérer les statistiques de l'utilisateur
 * Nécessite un token JWT valide
 *
 * @swagger
 * /api/user/stats:
 *   get:
 *     tags:
 *       - User
 *     summary: Récupérer les statistiques de l'utilisateur
 *     description: Retourne les statistiques complètes de l'utilisateur authentifié incluant le nombre de cours, vues, téléchargements, likes, et l'historique des activités récentes
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiques utilisateur récupérées avec succès
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
 *                   example: Statistiques récupérées avec succès
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalCoursesCreated:
 *                       type: integer
 *                       example: 5
 *                     totalViewsOnPublishedCourses:
 *                       type: integer
 *                       example: 250
 *                     totalDownloadsOnPublishedCourses:
 *                       type: integer
 *                       example: 45
 *                     totalLikesOnPublishedCourses:
 *                       type: integer
 *                       example: 30
 *                     isActive:
 *                       type: boolean
 *                       example: true
 *                     recentActivities:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [project, document, comment, like, invitation]
 *                             example: project
 *                           title:
 *                             type: string
 *                             example: Mon Cours Avancé
 *                           description:
 *                             type: string
 *                             example: Projet modifié
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                             example: 2024-01-15T10:30:00Z
 *       401:
 *         description: Non autorisé (token manquant ou invalide)
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
import {
    successResponse,
    notFoundResponse,
    serverErrorResponse,
} from "@/utils/api-response";
import type { UserStats, RecentActivity } from "@/types/api.types";

/**
 * Handler GET pour récupérer les statistiques de l'utilisateur
 * @param request - Requête Next.js avec le header x-user-id
 * @returns Réponse JSON avec les statistiques de l'utilisateur
 */
export async function GET(request: NextRequest) {
    try {
        // Récupère l'userId depuis le header (ajouté par le middleware)
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return notFoundResponse("Utilisateur non trouvé");
        }

        // Vérifie que l'utilisateur existe
        const user = await prisma.user.findUnique({
            where: { user_id: userId },
        });

        if (!user) {
            return notFoundResponse("Utilisateur non trouvé");
        }

        // 1. Nombre total de cours créés
        const totalCoursesCreated = await prisma.project.count({
            where: { owner_id: userId },
        });

        // 2. Récupère tous les cours publiés de l'utilisateur
        const publishedCourses = await prisma.project.findMany({
            where: {
                owner_id: userId,
                is_published: true,
            },
            select: {
                pr_id: true,
                documents: {
                    select: {
                        consult: true,
                        downloaded: true,
                    },
                },
            },
        });

        // Calcule les statistiques à partir des documents
        let totalViewsOnPublishedCourses = 0;
        let totalDownloadsOnPublishedCourses = 0;

        for (const course of publishedCourses) {
            for (const doc of course.documents) {
                totalViewsOnPublishedCourses += doc.consult || 0;
                totalDownloadsOnPublishedCourses += doc.downloaded || 0;
            }
        }

        // 3. Nombre de likes sur les cours publiés
        const coursesIds = publishedCourses.map((c) => c.pr_id);

        const totalLikesOnPublishedCourses = await prisma.like.count({
            where: {
                document: {
                    project: {
                        owner_id: userId,
                        is_published: true,
                    },
                },
            },
        });

        // 4. Détermine si l'utilisateur est actif (activité dans les 30 derniers jours)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Vérifie l'activité récente en parallèle
        const [
            projectActivity,
            commentActivity,
            likeActivity,
            partActivity,
            chapterActivity,
            paragraphActivity,
            notionActivity,
        ] = await Promise.all([
            prisma.project.count({
                where: {
                    owner_id: userId,
                    updated_at: { gte: thirtyDaysAgo },
                },
            }),
            prisma.comment.count({
                where: {
                    author_id: userId,
                    created_at: { gte: thirtyDaysAgo },
                },
            }),
            prisma.like.count({
                where: {
                    liker_id: userId,
                    like_at: { gte: thirtyDaysAgo },
                },
            }),
            prisma.part.count({
                where: { owner_id: userId },
            }),
            prisma.chapter.count({
                where: { owner_id: userId },
            }),
            prisma.paragraph.count({
                where: { owner_id: userId },
            }),
            prisma.notion.count({
                where: { owner_id: userId },
            }),
        ]);

        const isActive =
            projectActivity > 0 ||
            commentActivity > 0 ||
            likeActivity > 0 ||
            partActivity > 0 ||
            chapterActivity > 0 ||
            paragraphActivity > 0 ||
            notionActivity > 0;

        // 5. Récupère les activités récentes
        const [recentProjects, recentComments, recentLikes, recentInvitations] = await Promise.all([
            prisma.project.findMany({
                where: { owner_id: userId },
                orderBy: { updated_at: "desc" },
                take: 50,
                select: {
                    pr_id: true,
                    pr_name: true,
                    updated_at: true,
                },
            }),
            prisma.comment.findMany({
                where: { author_id: userId },
                orderBy: { updated_at: "desc" },
                take: 50,
                select: {
                    comment_id: true,
                    content: true,
                    updated_at: true,
                    project: {
                        select: { pr_name: true },
                    },
                },
            }),
            prisma.like.findMany({
                where: { liker_id: userId },
                orderBy: { like_at: "desc" },
                take: 50,
                select: {
                    id: true,
                    like_at: true,
                    document: {
                        select: { doc_name: true },
                    },
                },
            }),
            prisma.invitation.findMany({
                where: { host_id: userId },
                orderBy: { invited_at: "desc" },
                take: 50,
                select: {
                    id: true,
                    invited_at: true,
                    guest: {
                        select: { firstname: true, lastname: true },
                    },
                    project: {
                        select: { pr_name: true },
                    },
                },
            }),
        ]);

        // Combine toutes les activités
        const activities: RecentActivity[] = [];

        // Ajoute les projets
        for (const project of recentProjects) {
            activities.push({
                type: "project",
                title: project.pr_name,
                description: "Projet modifié",
                timestamp: project.updated_at,
            });
        }

        // Ajoute les commentaires
        for (const comment of recentComments) {
            activities.push({
                type: "comment",
                title: `Commentaire sur "${comment.project.pr_name}"`,
                description: comment.content.substring(0, 100),
                timestamp: comment.updated_at,
            });
        }

        // Ajoute les likes
        for (const like of recentLikes) {
            activities.push({
                type: "like",
                title: `Aimé "${like.document.doc_name}"`,
                description: "Document aimé",
                timestamp: like.like_at,
            });
        }

        // Ajoute les invitations
        for (const invitation of recentInvitations) {
            activities.push({
                type: "invitation",
                title: `Invitation envoyée à ${invitation.guest.firstname} ${invitation.guest.lastname}`,
                description: `Pour le projet "${invitation.project.pr_name}"`,
                timestamp: invitation.invited_at,
            });
        }

        // Trie toutes les activités par date décroissante
        const recentActivities = activities.sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
        ).slice(0, 20); // Limite à 20 activités les plus récentes

        const stats: UserStats = {
            totalCoursesCreated,
            totalViewsOnPublishedCourses,
            totalDownloadsOnPublishedCourses,
            totalLikesOnPublishedCourses,
            isActive,
            recentActivities,
        };

        return successResponse("Statistiques récupérées avec succès", stats);
    } catch (error) {
        console.error("Erreur lors de la récupération des statistiques:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la récupération des statistiques",
            error instanceof Error ? error.message : undefined
        );
    }
}
