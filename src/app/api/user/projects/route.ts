import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    serverErrorResponse,
} from "@/utils/api-response";

/**
 * GET /api/user/projects
 * Get all projects for the authenticated user with aggregated stats
 */
export async function GET(request: NextRequest) {
    try {
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Non authentifié", undefined, 401);
        }

        const projects = await prisma.project.findMany({
            where: {
                owner_id: userId,
            },
            include: {
                _count: {
                    select: {
                        parts: true,
                        documents: true,
                        comments: true,
                    },
                },
                documents: {
                    select: {
                        consult: true,
                        downloaded: true,
                        _count: {
                            select: {
                                likes: true,
                                views: true,
                            }
                        }
                    }
                }
            },
            orderBy: {
                updated_at: "desc",
            },
        });

        const formattedProjects = projects.map((p) => {
            const totalViews = p.documents.reduce((acc, doc) => acc + (doc.consult || 0), 0);
            const totalDownloads = p.documents.reduce((acc, doc) => acc + (doc.downloaded || 0), 0);
            const totalLikes = p.documents.reduce((acc, doc) => acc + (doc._count?.likes || 0), 0);
            const totalDocViews = p.documents.reduce((acc, doc) => acc + (doc._count?.views || 0), 0);

            return {
                id: p.pr_id,
                name: p.pr_name,
                created_at: p.created_at,
                updated_at: p.updated_at,
                is_published: p.is_published,
                description: p.description,
                category: p.category,
                level: p.level,
                stats: {
                    parts: p._count?.parts || 0,
                    documents: p._count?.documents || 0,
                    comments: p._count?.comments || 0,
                    views: totalViews,
                    downloads: totalDownloads,
                    likes: totalLikes,
                    uniqueViews: totalDocViews,
                }
            };
        });

        return successResponse("Projets récupérés avec succès", {
            projects: formattedProjects,
            count: formattedProjects.length,
        });
    } catch (error) {
        console.error("Erreur /api/user/projects:", error);
        return serverErrorResponse(
            "Erreur serveur",
            error instanceof Error ? error.message : undefined
        );
    }
}
