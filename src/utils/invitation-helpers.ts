/**
 * @fileoverview Helpers pour gérer les invitations de projet
 */

import crypto from "crypto";
import prisma from "@/lib/prisma";
import { InvitationEmailData } from "@/types/invitation.types";

/**
 * Génère un token unique et sécurisé pour une invitation
 * @returns Token d'invitation en base64 URL-safe
 */
export function generateInvitationToken(): string {
    return crypto
        .randomBytes(32)
        .toString("hex");
}

/**
 * Crée une nouvelle invitation
 * @param projectId - ID du projet
 * @param guestId - ID de l'invité (guest)
 * @param hostId - ID du créateur du projet (host)
 * @returns L'invitation créée
 */
export async function createInvitation(
    projectId: string,
    guestId: string,
    hostId: string
) {
    const token = generateInvitationToken();

    // Vérifier s'il y a déjà une invitation pour ce projet et cet invité
    const existingInvitation = await prisma.invitation.findFirst({
        where: {
            AND: [
                { pr_id: projectId },
                { guest_id: guestId },
            ],
        },
    });

    if (existingInvitation) {
        throw new Error("Une invitation existe déjà pour cet utilisateur sur ce projet");
    }

    const invitation = await prisma.invitation.create({
        data: {
            pr_id: projectId,
            guest_id: guestId,
            host_id: hostId,
            invitation_token: token,
            invitation_state: "Pending",
        },
    });

    // Notification in-app → cloche, clic vers la page d'acceptation
    try {
        const [project, host] = await Promise.all([
            prisma.project.findUnique({
                where: { pr_id: projectId },
                select: { pr_name: true },
            }),
            prisma.user.findUnique({
                where: { user_id: hostId },
                select: { firstname: true, lastname: true },
            }),
        ]);

        const hostName =
            [host?.firstname, host?.lastname].filter(Boolean).join(" ").trim() ||
            "Un collaborateur";
        const projectName = project?.pr_name || "un projet";

        await prisma.notification.create({
            data: {
                user_id: guestId,
                type: "PROJECT_INVITATION",
                message: `${hostName} vous invite à collaborer sur « ${projectName} »`,
                link: `/invitations/${token}`,
            },
        });
    } catch (notifError) {
        console.error("[invitation] Notification non créée :", notifError);
    }

    return invitation;
}

/**
 * Accepte une invitation
 * @param token - Token d'invitation
 * @returns L'invitation mise à jour
 */
export async function acceptInvitation(token: string) {
    const invitation = await prisma.invitation.findUnique({
        where: { invitation_token: token },
        include: { project: true, guest: true },
    });

    if (!invitation) {
        throw new Error("Invitation non trouvée");
    }

    if (invitation.invitation_state !== "Pending") {
        throw new Error(`Cette invitation a déjà été ${invitation.invitation_state.toLowerCase()}`);
    }

    const updated = await prisma.invitation.update({
        where: { invitation_token: token },
        data: {
            invitation_state: "Accepted",
            response_at: new Date(),
        },
        include: { project: true, guest: true },
    });

    await markInvitationNotificationRead(invitation.guest_id, token);

    return updated;
}

/**
 * Refuse une invitation
 * Supprime l'invitation de la base de données pour permettre une nouvelle invitation ultérieurement
 * @param token - Token d'invitation
 * @returns L'invitation supprimée
 */
export async function declineInvitation(token: string) {
    const invitation = await prisma.invitation.findUnique({
        where: { invitation_token: token },
    });

    if (!invitation) {
        throw new Error("Invitation non trouvée");
    }

    if (invitation.invitation_state !== "Pending") {
        throw new Error(`Cette invitation a déjà été ${invitation.invitation_state.toLowerCase()}`);
    }

    const guestId = invitation.guest_id;

    // Supprimer l'invitation pour permettre une nouvelle invitation ultérieurement
    const deleted = await prisma.invitation.delete({
        where: { invitation_token: token },
    });

    await markInvitationNotificationRead(guestId, token);

    return deleted;
}

/** Marque comme lue la notif liée à une invitation (acceptée ou refusée). */
async function markInvitationNotificationRead(userId: string, token: string) {
    try {
        await prisma.notification.updateMany({
            where: {
                user_id: userId,
                type: "PROJECT_INVITATION",
                link: `/invitations/${token}`,
                is_read: false,
            },
            data: { is_read: true },
        });
    } catch (err) {
        console.error("[invitation] Impossible de marquer la notif comme lue :", err);
    }
}

/**
 * Récupère une invitation par token
 * @param token - Token d'invitation
 * @returns L'invitation avec ses relations
 */
export async function getInvitationByToken(token: string) {
    return await prisma.invitation.findUnique({
        where: { invitation_token: token },
        include: {
            project: true,
            guest: true,
            host: true,
        },
    });
}

/**
 * Récupère toutes les invitations en attente pour un projet
 * @param projectId - ID du projet
 * @returns Liste des invitations
 */
export async function getPendingInvitationsByProject(projectId: string) {
    return await prisma.invitation.findMany({
        where: {
            pr_id: projectId,
            invitation_state: "Pending",
        },
        include: {
            guest: true,
            host: true,
        },
    });
}

/**
 * Vérifie si un utilisateur est invité sur un projet
 * @param projectId - ID du projet
 * @param userId - ID de l'utilisateur
 * @returns true si l'utilisateur a une invitation acceptée
 */
export async function isUserInvitedToProject(projectId: string, userId: string) {
    const invitation = await prisma.invitation.findFirst({
        where: {
            AND: [
                { pr_id: projectId },
                { guest_id: userId },
                { invitation_state: "Accepted" },
            ],
        },
    });

    return !!invitation;
}

/**
 * Prépare les données pour l'email d'invitation
 * @param invitation - L'invitation avec ses relations
 * @param baseUrl - URL de base de l'application
 * @returns Données formatées pour l'email
 */
export function prepareInvitationEmailData(
    invitation: any,
    baseUrl: string
): InvitationEmailData {
    const invitationLink = `${baseUrl}/invitations/${invitation.invitation_token}`;

    return {
        guestEmail: invitation.guest.email,
        guestFirstname: invitation.guest.firstname,
        hostFirstname: invitation.host.firstname,
        projectName: invitation.project.pr_name,
        invitationLink
    };
}
