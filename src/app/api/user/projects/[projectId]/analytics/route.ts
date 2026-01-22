import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    serverErrorResponse,
} from "@/utils/api-response";

/**
 * GET /api/user/projects/[projectId]/analytics
 * Get detailed analytics for a specific project
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { projectId: string } }
) {
    try {
        const userId = request.headers.get("x-user-id");
        const { projectId } = params;

        if (!userId) {
            return errorResponse("Non authentifié", undefined, 401);
        }

        // Verify project ownership
        const project = await prisma.project.findFirst({
            where: {
                pr_id: projectId,
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
                        doc_id: true,
                        doc_name: true,
                        consult: true,
                        downloaded: true,
                        published_at: true,
                        _count: {
                            select: {
                                likes: true,
                                views: true,
                            }
                        }
                    }
                },
                parts: {
                    include: {
                        _count: {
                            select: {
                                chapters: true,
                            }
                        }
                    }
                }
            },
        });

        if (!project) {
            return errorResponse("Projet non trouvé", undefined, 404);
        }

        // Calculate analytics
        const totalViews = project.documents.reduce((acc, doc) => acc + (doc.consult || 0), 0);
        const totalDownloads = project.documents.reduce((acc, doc) => acc + (doc.downloaded || 0), 0);
        const totalLikes = project.documents.reduce((acc, doc) => acc + (doc._count?.likes || 0), 0);
        const totalUniqueViews = project.documents.reduce((acc, doc) => acc + (doc._count?.views || 0), 0);

        // Most viewed documents
        const topDocuments = project.documents
            .sort((a, b) => (b.consult || 0) - (a.consult || 0))
            .slice(0, 5)
            .map(doc => ({
                id: doc.doc_id,
                name: doc.doc_name,
                views: doc.consult || 0,
                downloads: doc.downloaded || 0,
                likes: doc._count?.likes || 0,
            }));

        const analytics = {
            project: {
                id: project.pr_id,
                name: project.pr_name,
                created_at: project.created_at,
                updated_at: project.updated_at,
                is_published: project.is_published,
                description: project.description,
                category: project.category,
                level: project.level,
            },
            stats: {
                parts: project._count?.parts || 0,
                chapters: project.parts.reduce((acc, part) => acc + (part._count?.chapters || 0), 0),
                documents: project._count?.documents || 0,
                comments: project._count?.comments || 0,
                views: totalViews,
                downloads: totalDownloads,
                likes: totalLikes,
                uniqueViews: totalUniqueViews,
            },
            topDocuments,
        };

        return successResponse("Analytics récupérées avec succès", analytics);
    } catch (error) {
        console.error("Erreur /api/user/projects/[projectId]/analytics:", error);
        return serverErrorResponse(
            "Erreur serveur",
            error instanceof Error ? error.message : undefined
        );
    }
}
