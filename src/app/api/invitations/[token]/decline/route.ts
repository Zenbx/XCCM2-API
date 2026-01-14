/**
 * @fileoverview Route API pour décliner une invitation
 * PATCH /api/invitations/[token]/decline
 */

import { NextRequest } from "next/server";
import {
    successResponse,
    errorResponse,
    serverErrorResponse,
} from "@/utils/api-response";
import { declineInvitation } from "@/utils/invitation-helpers";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;

        // Refuser l'invitation
        const invitation = await declineInvitation(token);

        return successResponse(
            "Invitation refusée avec succès",
            {
                invitation: {
                    id: invitation.id,
                    status: invitation.invitation_state,
                    response_at: invitation.response_at,
                },
            },
            200
        );
    } catch (error) {
        console.error("Erreur lors du refus de l'invitation:", error);

        if (error instanceof Error) {
            if (error.message.includes("non trouvée")) {
                return errorResponse("Invitation non trouvée", undefined, 404);
            }
            if (error.message.includes("déjà été")) {
                return errorResponse(error.message, undefined, 400);
            }
        }

        return serverErrorResponse(
            "Erreur lors du refus de l'invitation"
        );
    }
}