/**
 * @openapi
 * /api/exercises/{exerciseId}:
 *   get:
 *     tags:
 *       - Exercises
 *     summary: Récupérer un exercice
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: exerciseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Exercice récupéré
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
 *                     exercise:
 *                       $ref: '#/components/schemas/Exercise'
 *       401:
 *         description: Non authentifié
 *       404:
 *         description: Exercice non trouvé
 *   put:
 *     tags:
 *       - Exercises
 *     summary: Modifier un exercice (créateur uniquement)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: exerciseId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               parameters:
 *                 type: object
 *               settings:
 *                 type: object
 *     responses:
 *       200:
 *         description: Exercice mis à jour
 *       403:
 *         description: Seul le créateur peut modifier
 *   delete:
 *     tags:
 *       - Exercises
 *     summary: Supprimer un exercice (créateur uniquement)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: exerciseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Exercice supprimé
 *       403:
 *         description: Seul le créateur peut supprimer
 *       404:
 *         description: Exercice non trouvé
 */
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
        exerciseId: string;
    }>;
};

/**
 * GET: Récupère un exercice spécifique
 */
export async function GET(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Utilisateur non authentifié", undefined, 401);

        const { exerciseId } = await context.params;

        const exercise = await prisma.exercise.findUnique({
            where: { id: exerciseId },
            include: {
                _count: { select: { submissions: true } }
            }
        });

        if (!exercise) return notFoundResponse("Exercice non trouvé");

        return successResponse("Exercice récupéré", { exercise });

    } catch (error) {
        console.error("Erreur récupération exercice:", error);
        return serverErrorResponse("Erreur serveur", error instanceof Error ? error.message : undefined);
    }
}

/**
 * PUT: Modifie un exercice (uniquement le créateur)
 */
export async function PUT(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Utilisateur non authentifié", undefined, 401);

        const { exerciseId } = await context.params;
        const body = await request.json();

        const exercise = await prisma.exercise.findUnique({
            where: { id: exerciseId }
        });

        if (!exercise) return notFoundResponse("Exercice non trouvé");
        if (exercise.creator_id !== userId) {
            return errorResponse("Seul le créateur peut modifier cet exercice", undefined, 403);
        }

        const dataToUpdate: any = {};
        if (body.title) dataToUpdate.title = body.title;
        if (body.parameters) dataToUpdate.parameters = body.parameters;
        if (body.settings !== undefined) dataToUpdate.settings = body.settings;

        const updatedExercise = await prisma.exercise.update({
            where: { id: exerciseId },
            data: dataToUpdate
        });

        return successResponse("Exercice mis à jour avec succès", { exercise: updatedExercise });

    } catch (error) {
        console.error("Erreur modification exercice:", error);
        return serverErrorResponse("Erreur serveur", error instanceof Error ? error.message : undefined);
    }
}

/**
 * DELETE: Supprime un exercice (uniquement le créateur)
 */
export async function DELETE(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Utilisateur non authentifié", undefined, 401);

        const { exerciseId } = await context.params;

        const exercise = await prisma.exercise.findUnique({
            where: { id: exerciseId }
        });

        if (!exercise) return notFoundResponse("Exercice non trouvé");
        if (exercise.creator_id !== userId) {
            return errorResponse("Seul le créateur peut supprimer cet exercice", undefined, 403);
        }

        // Supprimer les soumissions associées d'abord
        await prisma.submission.deleteMany({
            where: { exercise_id: exerciseId }
        });

        await prisma.exercise.delete({
            where: { id: exerciseId }
        });

        return successResponse("Exercice supprimé avec succès");

    } catch (error) {
        console.error("Erreur suppression exercice:", error);
        return serverErrorResponse("Erreur serveur", error instanceof Error ? error.message : undefined);
    }
}
