/**
 * @openapi
 * /api/community/feed:
 *   get:
 *     tags:
 *       - Community
 *     summary: Fil d'actualité de la communauté
 *     description: Récupère les 20 derniers projets publiés par les membres de la plateforme.
 *     responses:
 *       200:
 *         description: Fil d'actualité récupéré
 */
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    serverErrorResponse,
} from "@/utils/api-response";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const cursor = searchParams.get('cursor');
        const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

        const projects = await prisma.project.findMany({
            where: { is_published: true },
            take: limit + 1,
            ...(cursor ? { cursor: { pr_id: cursor }, skip: 1 } : {}),
            orderBy: { updated_at: 'desc' },
            include: {
                owner: {
                    select: { firstname: true, lastname: true, occupation: true }
                },
                documents: {
                    select: {
                        consult: true,
                        _count: { select: { likes: true } }
                    }
                },
                _count: { select: { comments: true } }
            }
        });

        const hasMore = projects.length > limit;
        const page = hasMore ? projects.slice(0, limit) : projects;
        const nextCursor = hasMore ? page[page.length - 1].pr_id : null;

        const feed = page.map(p => {
            let totalViews = 0;
            let totalLikes = 0;
            p.documents.forEach(doc => {
                totalViews += doc.consult;
                totalLikes += doc._count.likes;
            });
            return {
                id: p.pr_id,
                title: p.pr_name,
                author: `${p.owner.firstname} ${p.owner.lastname}`,
                authorRole: p.owner.occupation || "Auteur",
                timeAgo: p.updated_at,
                likes: totalLikes,
                comments: p._count.comments,
                views: totalViews,
                category: p.category || "Général",
                image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=800",
                description: p.description || "Aucune description disponible."
            };
        });

        return successResponse("Community feed retrieved", { feed, nextCursor, hasMore });

    } catch (error) {
        console.error("Error retrieving community feed:", error);
        return serverErrorResponse(
            "Error retrieving community feed",
            error instanceof Error ? error.message : undefined
        );
    }
}
