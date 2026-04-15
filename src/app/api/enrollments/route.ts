import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { enrollClassroomSchema } from "@/utils/validation";
import {
    successResponse,
    errorResponse,
    validationErrorResponse,
    serverErrorResponse,
} from "@/utils/api-response";
import { ZodError } from "zod";

/**
 * @openapi
 * /api/enrollments:
 *   post:
 *     tags:
 *       - Classrooms
 *     summary: Rejoindre une classe (S'inscrire)
 *     description: Permet à un étudiant de rejoindre une classe en utilisant un code d'invitation (join_code).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [join_code]
 *             properties:
 *               join_code: { type: string, example: "A7B9F1" }
 *     responses:
 *       201:
 *         description: Inscription réussie
 *       400:
 *         description: Erreur (ex: le professeur ne peut pas rejoindre sa classe)
 *       404:
 *         description: Code invalide
 *       409:
 *         description: Déjà inscrit
 */
export async function POST(request: NextRequest) {
    try {
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Utilisateur non authentifié", undefined, 401);
        }

        const body = await request.json();
        const validatedData = enrollClassroomSchema.parse(body);

        // On cherche la classe avec ce code
        const classroom = await prisma.classroom.findUnique({
            where: { join_code: validatedData.join_code.toUpperCase() }
        });

        if (!classroom) {
            return errorResponse("Code de classe invalide ou introuvable", undefined, 404);
        }

        // On vérifie que le professeur n'essaie pas de rejoindre sa propre classe
        if (classroom.teacher_id === userId) {
            return errorResponse("Vous êtes le professeur de cette classe", undefined, 400);
        }

        // On vérifie si l'étudiant est déjà inscrit
        const existingEnrollment = await prisma.enrollment.findUnique({
            where: {
                student_id_classroom_id: {
                    student_id: userId,
                    classroom_id: classroom.id
                }
            }
        });

        if (existingEnrollment) {
            return errorResponse("Vous êtes déjà inscrit à cette classe", undefined, 409);
        }

        // Créer l'inscription
        const enrollment = await prisma.enrollment.create({
            data: {
                student_id: userId,
                classroom_id: classroom.id
            },
            include: {
                classroom: {
                    select: { name: true, description: true }
                }
            }
        });

        return successResponse("Vous avez rejoint la classe avec succès", { enrollment }, 201);

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

        console.error("Erreur lors de l'inscription à la classe:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de l'inscription à la classe",
            error instanceof Error ? error.message : undefined
        );
    }
}
