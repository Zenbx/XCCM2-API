import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    serverErrorResponse,
} from "@/utils/api-response";

export async function GET(request: NextRequest) {
    try {
        // Fetch users who have published projects
        // We need to aggregate their stats. 
        // Since we can't easily do complex aggregation + sorting in one Prisma query across 3 levels (User -> Project -> Document -> Views/Likes),
        // We'll fetch active creators and calculate.

        // Get users with their published projects and associated document stats
        const creators = await prisma.user.findMany({
            where: {
                projects: {
                    some: {
                        is_published: true
                    }
                }
            },
            select: {
                user_id: true,
                firstname: true,
                lastname: true,
                occupation: true, // e.g. "Professeur CS"
                profile_picture: true,
                projects: {
                    where: { is_published: true },
                    select: {
                        documents: {
                            select: {
                                consult: true, // views
                                likes: { // count likes
                                    select: { id: true }
                                }
                            }
                        }
                    }
                }
            }
        });

        // Calculate scores
        const rankedCreators = creators.map(creator => {
            let totalViews = 0;
            let totalLikes = 0;

            creator.projects.forEach(project => {
                project.documents.forEach(doc => {
                    totalViews += doc.consult;
                    totalLikes += doc.likes.length;
                });
            });

            // Simple scoring algorithm: Views + (Likes * 5)
            // Adjust weights as needed
            const score = totalViews + (totalLikes * 5);

            return {
                id: creator.user_id,
                name: `${creator.firstname} ${creator.lastname}`,
                role: creator.occupation || "Créateur",
                profile_picture: creator.profile_picture,
                stats: {
                    views: totalViews,
                    likes: totalLikes,
                    projects: creator.projects.length
                },
                score
            };
        });

        // Sort by score descending and take top 10
        const topCreators = rankedCreators
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);

        return successResponse("Top creators retrieved successfully", topCreators);

    } catch (error) {
        console.error("Error retrieving top creators:", error);
        return serverErrorResponse(
            "Error retrieving top creators",
            error instanceof Error ? error.message : undefined
        );
    }
}
