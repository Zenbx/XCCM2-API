/**
 * @fileoverview Route API pour révoquer une invitation
 * DELETE /api/invitations/[token]/revoke
 * 
 * Permet au créateur du projet (host) d'annuler une invitation avant qu'elle ne soit acceptée
 * Documentation Swagger dans: src/app/api/invitations/[token]/route.ts
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    serverErrorResponse,
} from "@/utils/api-response";

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        // Récupérer l'userId depuis le header (injecté par le middleware)
        const userId = request.headers.get("x-user-id");
        if (!userId) {
            return errorResponse("Non authentifié", undefined, 401);
        }

        const { token: invitationToken } = await params;

        // Récupérer l'invitation
        const invitation = await prisma.invitation.findUnique({
            where: { invitation_token: invitationToken },
            include: { project: true },
        });

        if (!invitation) {
            return errorResponse("Invitation non trouvée", undefined, 404);
        }

        // Vérifier que c'est le créateur du projet qui essaie de révoquer
        if (invitation.host_id !== userId) {
            return errorResponse(
                "Vous n'êtes pas autorisé à révoquer cette invitation",
                undefined,
                403
            );
        }

        // Vérifier que l'invitation est toujours en attente
        if (invitation.invitation_state !== "Pending") {
            return errorResponse(
                invitation.invitation_state === "Accepted"
                    ? "Impossible de révoquer une invitation déjà acceptée"
                    : "Cette invitation a déjà été déclinée",
                undefined,
                400
            );
        }

        // Supprimer l'invitation
        await prisma.invitation.delete({
            where: { id: invitation.id },
        });

        return successResponse(
            "Invitation révoquée avec succès",
            {
                invitation_id: invitation.id,
                project_name: invitation.project.pr_name,
            },
            200
        );
    } catch (error) {
        console.error("Erreur lors de la révocation de l'invitation:", error);
        return serverErrorResponse(
            "Erreur lors de la révocation de l'invitation"
        );
    }
}
