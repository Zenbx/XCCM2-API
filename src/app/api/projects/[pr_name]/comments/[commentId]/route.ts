import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    notFoundResponse,
    serverErrorResponse,
} from "@/utils/api-response";

type RouteParams = {
    params: Promise<{ pr_name: string; commentId: string }>;
};

/**
 * DELETE /api/projects/:pr_name/comments/:commentId
 * Seul l'auteur du commentaire ou le propriétaire du projet peut supprimer.
 */
export async function DELETE(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Non authentifié", undefined, 401);

        const { pr_name: encodedName, commentId } = await context.params;
        const pr_name = decodeURIComponent(encodedName);

        // Vérifier que le projet existe et que l'utilisateur y a accès
        const project = await prisma.project.findFirst({
            where: {
                pr_name,
                OR: [
                    { owner_id: userId },
                    {
                        invitations: {
                            some: {
                                guest_id: userId,
                                invitation_state: "Accepted",
                            },
                        },
                    },
                ],
            },
        });

        if (!project) return notFoundResponse("Projet non trouvé");

        // Vérifier que le commentaire existe et appartient à ce projet
        const comment = await prisma.comment.findFirst({
            where: { comment_id: commentId, pr_id: project.pr_id },
        });

        if (!comment) return notFoundResponse("Commentaire non trouvé");

        // Seul l'auteur ou le propriétaire du projet peut supprimer
        const isAuthor  = comment.author_id === userId;
        const isOwner   = project.owner_id  === userId;

        if (!isAuthor && !isOwner) {
            return errorResponse("Vous ne pouvez pas supprimer ce commentaire", undefined, 403);
        }

        await prisma.comment.delete({ where: { comment_id: commentId } });

        // Broadcast temps réel
        try {
            const { realtimeService } = await import("@/services/realtime-service");
            await realtimeService.broadcastStructureChange(pr_name, "COMMENT_DELETED", {
                commentId,
                action: "deleted",
            });
        } catch {
            // fire-and-forget — ne pas bloquer la réponse si Ably échoue
        }

        return successResponse("Commentaire supprimé");
    } catch (error) {
        return serverErrorResponse(
            "Erreur suppression commentaire",
            error instanceof Error ? error.message : undefined
        );
    }
}
