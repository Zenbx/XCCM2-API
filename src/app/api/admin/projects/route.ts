import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    serverErrorResponse,
} from "@/utils/api-response";

/**
 * GET /api/admin/projects
 * Récupère tous les projets de la plateforme (Admin uniquement)
 */
export async function GET(request: NextRequest) {
    try {
        const userRole = request.headers.get("x-user-role");

        if (userRole !== "admin") {
            return errorResponse("Accès refusé", undefined, 403);
        }

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
            },
            orderBy: {
                created_at: "desc",
            },
        });

        const formattedProjects = projects.map((p) => ({
            id: p.pr_id,
            name: p.pr_name,
            owner: `${p.owner.firstname} ${p.owner.lastname}`,
            email: p.owner.email,
            created: p.created_at,
            status: p.is_published ? "Published" : "Active",
            size: `${p._count.parts} chapitres`, // Simplified size info
        }));

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
