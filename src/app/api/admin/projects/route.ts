import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    serverErrorResponse,
} from "@/utils/api-response";

/**
 * @openapi
 * /api/admin/projects:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Lister tous les projets de la plateforme (Admin)
 *     description: Récupère la liste complète des projets avec leurs statistiques de consultation.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des projets récupérée
 *       403:
 *         description: Accès refusé
 */
export async function GET(request: NextRequest) {
    try {
        const userRole = request.headers.get("x-user-role");

        const projects = await prisma.project.findMany({
            include: {
                owner: {
                    select: {
                        user_id: true,
                        firstname: true,
                        lastname: true,
                        email: true,
                    },
                },
                _count: {
                    select: {
                        parts: true,
                    },
                },
                documents: {
                    select: {
                        consult: true,
                        downloaded: true,
                        _count: {
                            select: {
                                likes: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                created_at: "desc",
            },
        });

        const formattedProjects = projects.map((p) => {
            const totalViews = p.documents.reduce((acc, doc) => acc + (doc.consult || 0), 0);
            const totalDownloads = p.documents.reduce((acc, doc) => acc + (doc.downloaded || 0), 0);
            const totalLikes = p.documents.reduce((acc, doc) => acc + (doc._count?.likes || 0), 0);

            return {
                id: p.pr_id,
                name: p.pr_name,
                owner: p.owner ? `${p.owner.firstname} ${p.owner.lastname}` : "Inconnu",
                email: p.owner?.email || "N/A",
                created: p.created_at,
                status: p.is_published ? "Published" : "Active",
                size: `${p._count?.parts || 0} chapitres`,
                stats: {
                    views: totalViews,
                    downloads: totalDownloads,
                    likes: totalLikes
                }
            };
        });

        return successResponse("Projets récupérés avec succès", {
            projects: formattedProjects,
            count: formattedProjects.length,
        });
    } catch (error) {
        console.error("Erreur /api/admin/projects:", error);
        return serverErrorResponse(
            "Erreur serveur",
            error instanceof Error ? error.message : undefined
        );
    }
}
