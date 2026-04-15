import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { createClassroomSchema } from "@/utils/validation";
import {
    successResponse,
    errorResponse,
    validationErrorResponse,
    serverErrorResponse,
} from "@/utils/api-response";
import { ZodError } from "zod";
import crypto from "crypto";

/**
 * Génère un code d'invitation unique (6 caractères alphanumériques majuscules)
 */
async function generateUniqueJoinCode(): Promise<string> {
    let joinCode = "";
    let isUnique = false;
    
    while (!isUnique) {
        joinCode = crypto.randomBytes(3).toString("hex").toUpperCase();
        const existing = await prisma.classroom.findUnique({
            where: { join_code: joinCode }
        });
        if (!existing) isUnique = true;
    }
    
    return joinCode;
}

/**
 * @openapi
 * /api/classrooms:
 *   get:
 *     tags:
 *       - Classrooms
 *     summary: Récupérer toutes les classes de l'utilisateur
 *     description: Retourne les classes où l'utilisateur est professeur et celles où il est étudiant.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Classes récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     teaching:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Classroom' }
 *                     enrolled:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Classroom' }
 *   post:
 *     tags:
 *       - Classrooms
 *     summary: Créer une nouvelle classe
 *     description: Crée une classe et génère d'un code d'invitation unique.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: Classe créée avec succès
 */
export async function GET(request: NextRequest) {
    try {
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Utilisateur non authentifié", undefined, 401);
        }

        // Classes où je suis le professeur
        const teachingClasses = await prisma.classroom.findMany({
            where: { teacher_id: userId },
            include: {
                _count: {
                    select: { enrollments: true, projects: true }
                }
            },
            orderBy: { created_at: "desc" }
        });

        // Classes où je suis étudiant
        const enrolledClasses = await prisma.enrollment.findMany({
            where: { student_id: userId },
            include: {
                classroom: {
                    include: {
                        teacher: {
                            select: { firstname: true, lastname: true, email: true }
                        },
                        _count: {
                            select: { projects: true }
                        }
                    }
                }
            },
            orderBy: { enrolled_at: "desc" }
        });

        return successResponse("Classes récupérées avec succès", {
            teaching: teachingClasses,
            enrolled: enrolledClasses.map(e => ({
                ...e.classroom,
                enrolled_at: e.enrolled_at
            }))
        });

    } catch (error) {
        console.error("Erreur lors de la récupération des classes:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la récupération des classes",
            error instanceof Error ? error.message : undefined
        );
    }
}

/**
 * POST: Crée une nouvelle classe (Le créateur devient le professeur)
 */
export async function POST(request: NextRequest) {
    try {
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Utilisateur non authentifié", undefined, 401);
        }

        const body = await request.json();
        const validatedData = createClassroomSchema.parse(body);

        const joinCode = await generateUniqueJoinCode();

        const newClassroom = await prisma.classroom.create({
            data: {
                name: validatedData.name,
                description: validatedData.description || null,
                join_code: joinCode,
                teacher_id: userId
            }
        });

        return successResponse("Classe créée avec succès", { classroom: newClassroom }, 201);

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

        console.error("Erreur lors de la création de la classe:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la création de la classe",
            error instanceof Error ? error.message : undefined
        );
    }
}
