import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    notFoundResponse,
    serverErrorResponse,
} from "@/utils/api-response";

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
