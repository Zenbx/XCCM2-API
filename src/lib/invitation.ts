/**
 * @fileoverview Schémas de validation Zod pour les invitations
 * Valide les données des requêtes API relatives aux invitations
 */
import { z } from "zod";

/**
 * Schema pour créer une nouvelle invitation
 */
export const createInvitationSchema = z.object({
  pr_id: z.string().min(1, "L'ID du projet est requis"),
  guest_email: z.string().email("Email invalide"),
});

/**
 * Schema pour accepter/décliner une invitation
 */
export const respondInvitationSchema = z.object({
  invitation_id: z.string().min(1, "L'ID de l'invitation est requis"),
});

/**
 * Schema pour les paramètres de route
 */
export const invitationIdParamSchema = z.object({
  invitation_id: z.string().min(1, "L'ID de l'invitation est requis"),
});

/**
 * Schema pour récupérer les invitations d'un projet
 */
export const projectInvitationsSchema = z.object({
  pr_id: z.string().min(1, "L'ID du projet est requis"),
});

/**
 * Types TypeScript dérivés des schémas
 */
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type RespondInvitationInput = z.infer<typeof respondInvitationSchema>;
export type InvitationIdParam = z.infer<typeof invitationIdParamSchema>;
export type ProjectInvitationsInput = z.infer<typeof projectInvitationsSchema>;