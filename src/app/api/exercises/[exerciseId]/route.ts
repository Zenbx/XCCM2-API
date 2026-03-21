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
