/**
 * @fileoverview Route API pour accepter une invitation
 * PATCH /api/invitations/[token]/accept
 * 
 * Documentation Swagger dans: src/lib/swagger-invitations-definitions.ts
 */

import { NextRequest } from "next/server";
import {
    successResponse,
    errorResponse,
    serverErrorResponse,
} from "@/utils/api-response";
import { acceptInvitation, getInvitationByToken } from "@/utils/invitation-helpers";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) {
            return errorResponse("Non authentifié", undefined, 401);
        }

        const { token } = await params;

        // Vérifier que l'invitation appartient bien à cet utilisateur
        const invitationCheck = await getInvitationByToken(token);
        if (!invitationCheck) {
            return errorResponse("Invitation non trouvée", undefined, 404);
        }

        if (invitationCheck.guest_id !== userId) {
            return errorResponse("Cette invitation ne vous est pas destinée", undefined, 403);
        }

        // Accepter l'invitation
        const invitation = await acceptInvitation(token);

        return successResponse(
            "Invitation acceptée avec succès",
            {
                invitation: {
                    id: invitation.id,
                    project_id: invitation.pr_id,
                    guest_id: invitation.guest_id,
                    status: invitation.invitation_state,
                    response_at: invitation.response_at,
                },
                redirect_to: `/edit?projectName=${invitation.project?.pr_name}`,
            },
            200
        );
    } catch (error) {
        console.error("Erreur lors de l'acceptation de l'invitation:", error);

        if (error instanceof Error) {
            if (error.message.includes("non trouvée")) {
                return errorResponse("Invitation non trouvée", undefined, 404);
            }
            if (error.message.includes("déjà été")) {
                return errorResponse(error.message, undefined, 400);
            }
        }

        return serverErrorResponse(
            "Erreur lors de l'acceptation de l'invitation"
        );
    }
}
