import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    serverErrorResponse,
} from "@/utils/api-response";

export async function GET(request: NextRequest) {
    try {
        // Fetch published projects for the feed
        // Sort by updated_at desc for "Recent" or we could implement tabs logic here.
        // For now, let's return the most recent 20 published projects.

        const projects = await prisma.project.findMany({
            where: {
                is_published: true
            },
            take: 20,
            orderBy: {
                updated_at: 'desc'
            },
            include: {
                owner: {
                    select: {
                        firstname: true,
                        lastname: true,
                        occupation: true
                    }
                },
                documents: {
                    select: {
                        consult: true,
                        likes: {
                            select: { id: true }
                        }
                    }
                },
                comments: {
                    select: { comment_id: true }
                }
            }
        });

        // Format for frontend
        const feed = projects.map(p => {
            let totalViews = 0;
            let totalLikes = 0;

            p.documents.forEach(doc => {
                totalViews += doc.consult;
                totalLikes += doc.likes.length;
            });

            return {
                id: p.pr_id,
                title: p.pr_name,
                author: `${p.owner.firstname} ${p.owner.lastname}`,
                authorRole: p.owner.occupation || "Auteur",
                timeAgo: p.updated_at, // Frontend can format this
                likes: totalLikes,
                comments: p.comments.length,
                views: totalViews,
                category: p.category || "Général",
                // Placeholder image if none exists, or logic to fetch cover
                image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=800",
                description: p.description || "Aucune description disponible."
            };
        });

        return successResponse("Community feed retrieved", feed);

    } catch (error) {
        console.error("Error retrieving community feed:", error);
        return serverErrorResponse(
            "Error retrieving community feed",
            error instanceof Error ? error.message : undefined
        );
    }
}
