/**
 * @openapi
 * /api/classrooms/{classId}/assignments/{assignmentId}/submit:
 *   post:
 *     tags:
 *       - Classrooms
 *     summary: Soumettre un devoir (étudiant)
 *     description: Crée ou met à jour la soumission de l'étudiant connecté pour un devoir donné (upsert).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: assignmentId
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
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: Texte de la réponse ou URL Cloudinary (fichier uploadé)
 *     responses:
 *       200:
 *         description: Devoir soumis
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
 *                     submission:
 *                       $ref: '#/components/schemas/AssignmentSubmission'
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Étudiant non inscrit
 *       404:
 *         description: Devoir introuvable
 *   patch:
 *     tags:
 *       - Classrooms
 *     summary: Noter une soumission (professeur)
 *     description: Le professeur attribue un score et un commentaire à une soumission d'étudiant.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: assignmentId
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
 *               - submissionId
 *             properties:
 *               submissionId:
 *                 type: string
 *               score:
 *                 type: number
 *               feedback:
 *                 type: string
 *     responses:
 *       200:
 *         description: Note enregistrée
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Seul le professeur peut noter
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

// ─── POST /api/classrooms/[classId]/assignments/[assignmentId]/submit ─────────
// Student submits their answer (text or Cloudinary URL)
export async function POST(
    request: NextRequest,
    { params }: { params: { classId: string; assignmentId: string } }
) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Utilisateur non authentifié", undefined, 401);

        const { classId, assignmentId } = params;

        // Verify student is enrolled
        const enrollment = await prisma.enrollment.findFirst({
            where: { classroom_id: classId, student_id: userId },
        });

        if (!enrollment) return forbiddenResponse("Vous n'êtes pas inscrit dans cette classe");

        const assignment = await prisma.assignment.findFirst({
            where: { id: assignmentId, classroom_id: classId },
        });

        if (!assignment) return notFoundResponse("Devoir introuvable");

        const body = await request.json();
        const { content } = body; // Could be raw text or Cloudinary URL

        if (!content || content.trim().length === 0) {
            return errorResponse("Le contenu de la soumission est requis");
        }

        // Upsert: one submission per student per assignment
        const submission = await prisma.assignmentSubmission.upsert({
            where: {
                assignment_id_student_id: {
                    assignment_id: assignmentId,
                    student_id: userId,
                },
            },
            update: {
                content: content.trim(),
                submitted_at: new Date(),
            },
            create: {
                content: content.trim(),
                assignment_id: assignmentId,
                student_id: userId,
            },
        });

        return successResponse("Devoir soumis avec succès", { submission });
    } catch (error) {
        return serverErrorResponse("Erreur lors de la soumission", error instanceof Error ? error.message : undefined);
    }
}

// ─── PATCH /api/classrooms/[classId]/assignments/[assignmentId]/submit ────────
// Teacher grades a submission: sets score + feedback
export async function PATCH(
    request: NextRequest,
    { params }: { params: { classId: string; assignmentId: string } }
) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Utilisateur non authentifié", undefined, 401);

        const { classId, assignmentId } = params;

        // Only teacher can grade
        const classroom = await prisma.classroom.findUnique({ where: { id: classId } });
        if (!classroom) return notFoundResponse("Classe introuvable");
        if (classroom.teacher_id !== userId)
            return forbiddenResponse("Seul le professeur peut noter un devoir");

        const body = await request.json();
        const { submissionId, score, feedback } = body;

        if (submissionId === undefined) return errorResponse("submissionId requis");

        const updated = await prisma.assignmentSubmission.update({
            where: { id: submissionId },
            data: {
                score: score !== undefined ? parseFloat(score) : undefined,
                feedback: feedback?.trim() || undefined,
            },
        });

        return successResponse("Note enregistrée", { submission: updated });
    } catch (error) {
        return serverErrorResponse("Erreur lors de la notation", error instanceof Error ? error.message : undefined);
    }
}
