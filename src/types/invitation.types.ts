/**
 * @fileoverview Types TypeScript pour les invitations de projet
 */

/**
 * Statuts possibles d'une invitation
 */
export type InvitationStatus = "Pending" | "Accepted" | "Rejected";

/**
 * Corps de la requête pour envoyer une invitation
 */
export interface SendInvitationRequest {
    guestEmail: string;
}

/**
 * Réponse d'invitation avec token
 */
export interface InvitationResponse {
    id: string;
    pr_id: string;
    guest_id: string;
    host_id: string;
    invitation_state: InvitationStatus;
    invitation_token: string;
    invited_at: Date;
    response_at?: Date | null;
}

/**
 * Données pour l'email d'invitation
 */
export interface InvitationEmailData {
    guestEmail: string;
    guestFirstname: string;
    hostFirstname: string;
    projectName: string;
    invitationLink: string;
}
