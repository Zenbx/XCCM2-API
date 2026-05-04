/**
 * @openapi
 * /api/classrooms/{classId}/announcements/{announcementId}/comments:
 *   post:
 *     tags:
 *       - Classrooms
 *     summary: Commenter une annonce
 *     description: Tout membre de la classe (professeur ou étudiant inscrit) peut commenter une annonce.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: announcementId
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
 *     responses:
 *       201:
 *         description: Commentaire ajouté
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Pas membre de cette classe
 *       404:
 *         description: Classe ou annonce introuvable
 *   delete:
 *     tags:
 *       - Classrooms
 *     summary: Supprimer un commentaire
 *     description: L'auteur du commentaire ou le professeur peut supprimer un commentaire.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: announcementId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Commentaire supprimé
 *       400:
 *         description: commentId manquant
 *       403:
 *         description: Pas autorisé à supprimer ce commentaire
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

// ─── POST /api/classrooms/[classId]/announcements/[announcementId]/comments ──
// Any class member (teacher OR student) can comment
export async function POST(
    request: NextRequest,
    { params }: { params: { classId: string; announcementId: string } }
) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Utilisateur non authentifié", undefined, 401);

        const { classId, announcementId } = params;

        // Verify user is member
        const classroom = await prisma.classroom.findUnique({
            where: { id: classId },
            include: { enrollments: { where: { student_id: userId } } },
        });

        if (!classroom) return notFoundResponse("Classe introuvable");

        const isMember =
            classroom.teacher_id === userId || classroom.enrollments.length > 0;

        if (!isMember)
            return forbiddenResponse("Vous n'avez pas accès à cette classe");

        // Verify announcement belongs to class
        const announcement = await prisma.announcement.findFirst({
            where: { id: announcementId, classroom_id: classId },
        });

        if (!announcement) return notFoundResponse("Annonce introuvable");

        const body = await request.json();
        const { content } = body;

        if (!content || content.trim().length === 0) {
            return errorResponse("Le commentaire ne peut pas être vide");
        }

        const comment = await prisma.announcementComment.create({
            data: {
                content: content.trim(),
                announcement_id: announcementId,
                author_id: userId,
            },
            include: {
                author: {
                    select: { user_id: true, firstname: true, lastname: true, profile_picture: true },
                },
            },
        });

        return successResponse("Commentaire ajouté", { comment }, 201);
    } catch (error) {
        return serverErrorResponse("Erreur lors de l'ajout du commentaire", error instanceof Error ? error.message : undefined);
    }
}

// ─── DELETE /api/classrooms/[classId]/announcements/[announcementId]/comments ─
// Query param: commentId. Allowed by comment author or teacher.
export async function DELETE(
    request: NextRequest,
    { params }: { params: { classId: string; announcementId: string } }
) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Utilisateur non authentifié", undefined, 401);

        const { classId, announcementId } = params;
        const commentId = request.nextUrl.searchParams.get("commentId");

        if (!commentId) return errorResponse("commentId requis");

        const classroom = await prisma.classroom.findUnique({
            where: { id: classId },
        });

        if (!classroom) return notFoundResponse("Classe introuvable");

        const comment = await prisma.announcementComment.findFirst({
            where: { id: commentId, announcement_id: announcementId },
        });

        if (!comment) return notFoundResponse("Commentaire introuvable");

        const canDelete =
            comment.author_id === userId || classroom.teacher_id === userId;

        if (!canDelete)
            return forbiddenResponse("Vous ne pouvez pas supprimer ce commentaire");

        await prisma.announcementComment.delete({ where: { id: commentId } });

        return successResponse("Commentaire supprimé");
    } catch (error) {
        return serverErrorResponse("Erreur lors de la suppression", error instanceof Error ? error.message : undefined);
    }
}
