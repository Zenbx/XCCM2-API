/**
 * @openapi
 * /api/classrooms/{classId}/assignments:
 *   get:
 *     tags:
 *       - Classrooms
 *     summary: Lister les devoirs d'une classe
 *     description: Professeur — voit toutes les soumissions. Étudiant — voit uniquement les siennes.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Devoirs récupérés
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     assignments:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Assignment'
 *                     isTeacher:
 *                       type: boolean
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès refusé
 *       404:
 *         description: Classe introuvable
 *   post:
 *     tags:
 *       - Classrooms
 *     summary: Créer un devoir (professeur uniquement)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 3
 *               description:
 *                 type: string
 *               due_date:
 *                 type: string
 *                 format: date-time
 *               type:
 *                 type: string
 *                 enum: [TEXT, FILE]
 *     responses:
 *       201:
 *         description: Devoir créé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     assignment:
 *                       $ref: '#/components/schemas/Assignment'
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Seul le professeur peut créer des devoirs
 */
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    serverErrorResponse,
    forbiddenResponse,
    notFoundResponse,
} from "@/utils/api-response";

// ─── GET /api/classrooms/[classId]/assignments ───────────────────────────────
export async function GET(
    request: NextRequest,
    { params }: { params: { classId: string } }
) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Utilisateur non authentifié", undefined, 401);

        const { classId } = params;

        const classroom = await prisma.classroom.findUnique({
            where: { id: classId },
            include: { enrollments: { where: { student_id: userId } } },
        });

        if (!classroom) return notFoundResponse("Classe introuvable");

        const isMember =
            classroom.teacher_id === userId || classroom.enrollments.length > 0;

        if (!isMember) return forbiddenResponse("Accès refusé");

        const isTeacher = classroom.teacher_id === userId;

        const assignments = await prisma.assignment.findMany({
            where: { classroom_id: classId },
            orderBy: { created_at: "desc" },
            include: {
                // Teacher: see all submissions grouped; Student: only their own
                submissions: isTeacher
                    ? {
                          include: {
                              student: {
                                  select: { user_id: true, firstname: true, lastname: true, profile_picture: true },
                              },
                          },
                      }
                    : {
                          where: { student_id: userId },
                      },
                _count: { select: { submissions: true } },
            },
        });

        return successResponse("Devoirs récupérés", { assignments, isTeacher });
    } catch (error) {
        return serverErrorResponse("Erreur lors de la récupération des devoirs", error instanceof Error ? error.message : undefined);
    }
}

// ─── POST /api/classrooms/[classId]/assignments ──────────────────────────────
export async function POST(
    request: NextRequest,
    { params }: { params: { classId: string } }
) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Utilisateur non authentifié", undefined, 401);

        const { classId } = params;

        const classroom = await prisma.classroom.findUnique({
            where: { id: classId },
            include: { enrollments: { select: { student_id: true } } },
        });

        if (!classroom) return notFoundResponse("Classe introuvable");
        if (classroom.teacher_id !== userId)
            return forbiddenResponse("Seul le professeur peut créer des devoirs");

        const body = await request.json();
        const { title, description, due_date, type } = body;

        if (!title || title.trim().length < 3) {
            return errorResponse("Le titre du devoir doit contenir au moins 3 caractères");
        }

        const assignment = await prisma.assignment.create({
            data: {
                title: title.trim(),
                description: description?.trim() || null,
                due_date: due_date ? new Date(due_date) : null,
                type: type === "FILE" ? "FILE" : "TEXT",
                classroom_id: classId,
            },
            include: {
                submissions: true,
                _count: { select: { submissions: true } },
            }
        });

        // Notify all students
        const notificationData = classroom.enrollments.map((e) => ({
            user_id: e.student_id,
            type: "NEW_ASSIGNMENT",
            message: `Nouveau devoir dans "${classroom.name}" : ${title}`,
            link: `/classrooms/${classId}?tab=assignments`,
        }));

        if (notificationData.length > 0) {
            await prisma.notification.createMany({ data: notificationData });
        }

        return successResponse("Devoir créé avec succès", { assignment }, 201);
    } catch (error) {
        return serverErrorResponse("Erreur lors de la création du devoir", error instanceof Error ? error.message : undefined);
    }
}
