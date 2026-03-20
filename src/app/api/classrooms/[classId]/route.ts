import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { updateClassroomSchema } from "@/utils/validation";
import {
    successResponse,
    errorResponse,
    notFoundResponse,
    validationErrorResponse,
    serverErrorResponse,
} from "@/utils/api-response";
import { ZodError } from "zod";

type RouteParams = {
    params: Promise<{
        classId: string;
    }>;
};

/**
 * GET: Récupère les détails d'une classe spécifique
 */
export async function GET(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Utilisateur non authentifié", undefined, 401);
        }

        const { classId } = await context.params;

        // On vérifie que la classe existe et que l'utilisateur a le droit de la voir
        // (Soit il est professeur, soit il est étudiant)
        const classroom = await prisma.classroom.findUnique({
            where: { id: classId },
            include: {
                teacher: {
                    select: { firstname: true, lastname: true, email: true }
                },
                projects: {
                    include: {
                        project: {
                            select: { pr_id: true, pr_name: true, description: true, category: true, level: true, author: true }
                        }
                    }
                },
                enrollments: {
                    include: {
                        student: {
                            select: { user_id: true, firstname: true, lastname: true, email: true }
                        }
                    }
                }
            }
        });

        if (!classroom) {
            return notFoundResponse("Classe non trouvée");
        }

        const isTeacher = classroom.teacher_id === userId;
        const isStudent = classroom.enrollments.some(e => e.student.user_id === userId);

        if (!isTeacher && !isStudent) {
            return errorResponse("Vous n'avez pas accès à cette classe", undefined, 403);
        }

        // Si c'est un étudiant, on cache la liste des autres étudiants pour des raisons de confidentialité
        if (isStudent && !isTeacher) {
            return successResponse("Classe récupérée avec succès", {
                classroom: {
                    ...classroom,
                    enrollments: undefined // L'élève ne voit pas la liste de la classe
                }
            });
        }

        return successResponse("Classe récupérée avec succès", { classroom });

    } catch (error) {
        console.error("Erreur lors de la récupération de la classe:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la récupération de la classe",
            error instanceof Error ? error.message : undefined
        );
    }
}

/**
 * PATCH: Modifie les informations d'une classe (Uniquement pour le professeur)
 */
export async function PATCH(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Utilisateur non authentifié", undefined, 401);
        }

        const { classId } = await context.params;

        const classroom = await prisma.classroom.findUnique({
            where: { id: classId }
        });

        if (!classroom) {
            return notFoundResponse("Classe non trouvée");
        }

        if (classroom.teacher_id !== userId) {
            return errorResponse("Seul le professeur peut modifier cette classe", undefined, 403);
        }

        const body = await request.json();
        const validatedData = updateClassroomSchema.parse(body);

        const updatedClassroom = await prisma.classroom.update({
            where: { id: classId },
            data: {
                ...(validatedData.name && { name: validatedData.name }),
                ...(validatedData.description !== undefined && { description: validatedData.description }),
            }
        });

        return successResponse("Classe mise à jour avec succès", { classroom: updatedClassroom });

    } catch (error) {
        if (error instanceof ZodError) {
            const errors: Record<string, string[]> = {};
            error.issues.forEach((err) => {
                const field = err.path.join(".");
                if (!errors[field]) {
                    errors[field] = [];
                }
                errors[field].push(err.message);
            });
            return validationErrorResponse(errors);
        }

        console.error("Erreur lors de la modification de la classe:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la modification de la classe",
            error instanceof Error ? error.message : undefined
        );
    }
}

/**
 * DELETE: Supprime une classe entiérement (Uniquement pour le professeur)
 */
export async function DELETE(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Utilisateur non authentifié", undefined, 401);
        }

        const { classId } = await context.params;

        const classroom = await prisma.classroom.findUnique({
            where: { id: classId }
        });

        if (!classroom) {
            return notFoundResponse("Classe non trouvée");
        }

        if (classroom.teacher_id !== userId) {
            return errorResponse("Seul le créateur peut supprimer cette classe", undefined, 403);
        }

        await prisma.classroom.delete({
            where: { id: classId }
        });

        return successResponse("Classe supprimée avec succès");

    } catch (error) {
        console.error("Erreur lors de la suppression de la classe:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la suppression de la classe",
            error instanceof Error ? error.message : undefined
        );
    }
}
