import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    notFoundResponse,
    serverErrorResponse,
} from "@/utils/api-response";

type RouteParams = {
    params: Promise<{
        classId: string;
    }>;
};

/**
 * GET: Liste les cours associés à une classe
 */
export async function GET(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Utilisateur non authentifié", undefined, 401);

        const { classId } = await context.params;

        const classroom = await prisma.classroom.findUnique({
            where: { id: classId },
            include: {
                projects: {
                    include: {
                        project: {
                            select: { pr_id: true, pr_name: true, description: true, category: true, level: true, author: true }
                        }
                    }
                }
            }
        });

        if (!classroom) return notFoundResponse("Classe non trouvée");

        const isTeacher = classroom.teacher_id === userId;
        if (!isTeacher) return errorResponse("Seul le professeur peut gérer les cours de la classe", undefined, 403);

        return successResponse("Cours de la classe récupérés", { projects: classroom.projects });

    } catch (error) {
        console.error("Erreur récupération cours:", error);
        return serverErrorResponse("Erreur serveur", error instanceof Error ? error.message : undefined);
    }
}

/**
 * POST: Assigne un cours (projet) à une classe
 * Body: { project_id: string }
 */
export async function POST(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Utilisateur non authentifié", undefined, 401);

        const { classId } = await context.params;
        const { project_id } = await request.json();

        if (!project_id) return errorResponse("project_id est requis", undefined, 400);

        // Vérifier que l'utilisateur est le professeur de la classe
        const classroom = await prisma.classroom.findUnique({ where: { id: classId } });
        if (!classroom) return notFoundResponse("Classe non trouvée");
        if (classroom.teacher_id !== userId) {
            return errorResponse("Seul le professeur peut ajouter des cours", undefined, 403);
        }

        // Vérifier que le projet existe
        const project = await prisma.project.findUnique({ where: { pr_id: project_id } });
        if (!project) return notFoundResponse("Projet non trouvé");

        // Vérifier si le lien existe déjà
        const existing = await prisma.classroomProject.findUnique({
            where: {
                classroom_id_project_id: {
                    classroom_id: classId,
                    project_id: project_id
                }
            }
        });

        if (existing) return errorResponse("Ce cours est déjà dans cette classe", undefined, 409);

        const link = await prisma.classroomProject.create({
            data: {
                classroom_id: classId,
                project_id: project_id
            },
            include: {
                project: {
                    select: { pr_id: true, pr_name: true, description: true }
                }
            }
        });

        return successResponse("Cours ajouté à la classe", { link }, 201);

    } catch (error) {
        console.error("Erreur ajout cours:", error);
        return serverErrorResponse("Erreur serveur", error instanceof Error ? error.message : undefined);
    }
}

/**
 * DELETE: Retire un cours d'une classe
 * Body: { project_id: string }
 */
export async function DELETE(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Utilisateur non authentifié", undefined, 401);

        const { classId } = await context.params;
        const { project_id } = await request.json();

        if (!project_id) return errorResponse("project_id est requis", undefined, 400);

        const classroom = await prisma.classroom.findUnique({ where: { id: classId } });
        if (!classroom) return notFoundResponse("Classe non trouvée");
        if (classroom.teacher_id !== userId) {
            return errorResponse("Seul le professeur peut retirer des cours", undefined, 403);
        }

        await prisma.classroomProject.delete({
            where: {
                classroom_id_project_id: {
                    classroom_id: classId,
                    project_id: project_id
                }
            }
        });

        return successResponse("Cours retiré de la classe");

    } catch (error) {
        console.error("Erreur retrait cours:", error);
        return serverErrorResponse("Erreur serveur", error instanceof Error ? error.message : undefined);
    }
}
