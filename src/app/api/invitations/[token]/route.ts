/**
 * @openapi
 * /api/invitations/{token}:
 *   get:
 *     tags:
 *       - Invitations
 *     summary: Récupérer les détails d'une invitation
 *     description: Route publique pour vérifier une invitation via son token unique (utilisé dans les emails).
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Détails de l'invitation
 *       404:
 *         description: Invitation non trouvée
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;

        console.log(`📨 Récupération invitation par token: ${token.substring(0, 8)}...`);

        const invitation = await getInvitationByToken(token);

        if (!invitation) {
            return notFoundResponse("Invitation non trouvée ou expirée");
        }

        // Retourner les infos de l'invitation (sans données sensibles)
        return successResponse("Invitation récupérée", {
            invitation: {
                id: invitation.id,
                projectName: invitation.project.pr_name,
                projectId: invitation.pr_id,
                status: invitation.invitation_state,
                inviterName: `${invitation.host.firstname} ${invitation.host.lastname}`.trim(),
                inviterEmail: invitation.host.email,
                recipientName: `${invitation.guest.firstname} ${invitation.guest.lastname}`.trim(),
                recipientEmail: invitation.guest.email,
                invitedAt: invitation.invited_at,
                responseAt: invitation.response_at,
            },
        });
    } catch (error) {
        console.error("Erreur lors de la récupération de l'invitation:", error);
        return serverErrorResponse(
            "Erreur lors de la récupération de l'invitation"
        );
    }
}
