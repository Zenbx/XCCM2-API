/**
 * @fileoverview Route API pour créer une invitation
 * POST /api/invitations - Créer une invitation et envoyer le lien par email
 *
 * @swagger
 * /api/invitations:
 *   post:
 *     tags:
 *       - Invitations
 *     summary: Créer une invitation
 *     description: Créer une nouvelle invitation pour un éditeur et envoyer le lien d'accès par email
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-user-id
 *         required: true
 *         schema:
 *           type: string
 *           example: "696777415ebbf5909b6d703a"
 *         description: ID de l'utilisateur connecté (propriétaire du projet)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pr_id
 *               - guest_email
 *             properties:
 *               pr_id:
 *                 type: string
 *                 description: ID du projet
 *                 example: "clx1234567890abcdefgh"
 *               guest_email:
 *                 type: string
 *                 format: email
 *                 description: Email de l'éditeur à inviter
 *                 example: "editeur@example.com"
 *     responses:
 *       201:
 *         description: Invitation créée avec succès et email envoyé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Invitation créée avec succès. Un email a été envoyé à editeur@example.com
 *                 invitation:
 *                   $ref: '#/components/schemas/Invitation'
 *                 invitationLink:
 *                   type: string
 *                   description: Lien d'invitation envoyé par email
 *                   example: "https://votreapp.com/projects/clx123.../join?token=xyz"
 *       400:
 *         description: Données invalides ou tentative de s'inviter soi-même
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Vous ne pouvez pas vous inviter vous-même
 *       401:
 *         description: Authentification requise
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Authentification requise
 *       404:
 *         description: Projet non trouvé ou utilisateur invité non trouvé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Utilisateur non trouvé avec cet email
 *       409:
 *         description: Une invitation existe déjà pour cet utilisateur
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Cet utilisateur a déjà été invité sur ce projet
 *                 invitation:
 *                   $ref: '#/components/schemas/Invitation'
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Erreur serveur lors de la création de l'invitation
 *
 * @swagger
 * components:
 *   schemas:
 *     Invitation:
 *       type: object
 *       properties:
 *         invitation_id:
 *           type: string
 *           description: ID unique de l'invitation
 *           example: "clx9876543210zyxwvuts"
 *         pr_id:
 *           type: string
 *           description: ID du projet
 *           example: "clx1234567890abcdefgh"
 *         guest_id:
 *           type: string
 *           description: ID de l'éditeur invité
 *           example: "clx5555555555555555"
 *         host_id:
 *           type: string
 *           description: ID du propriétaire du projet
 *           example: "clx6666666666666666"
 *         invitation_state:
 *           type: string
 *           enum: [Pending, Accepted, Rejected]
 *           description: Statut de l'invitation
 *           example: Pending
 *         invited_at:
 *           type: string
 *           format: date-time
 *           description: Date et heure de création de l'invitation
 *           example: "2024-01-14T10:30:00Z"
 *         access_token:
 *           type: string
 *           description: Token d'accès sécurisé pour rejoindre le projet
 *           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *         guest:
 *           type: object
 *           description: Informations de l'éditeur invité
 *           properties:
 *             user_id:
 *               type: string
 *               example: "clx5555555555555555"
 *             email:
 *               type: string
 *               example: "editeur@example.com"
 *             firstname:
 *               type: string
 *               example: "Jean"
 *             lastname:
 *               type: string
 *               example: "Martin"
 *         project:
 *           type: object
 *           description: Informations du projet
 *           properties:
 *             pr_id:
 *               type: string
 *               example: "clx1234567890abcdefgh"
 *             pr_name:
 *               type: string
 *               example: "Mon Projet Collaboratif"
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createInvitationSchema } from "@/lib/invitation";
import crypto from "crypto";
import { sendInvitationEmail } from "@/lib/email"; // ← Ajoutez cet import

/**
 * POST /api/invitations
 * Créer une invitation pour un éditeur et envoyer le lien par email
 * 
 * Body: { pr_id: string, guest_email: string }
 * Headers: x-user-id (ID du propriétaire connecté)
 * Returns: Invitation créée avec le lien d'accès
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validation des données
    const validatedData = createInvitationSchema.parse(body);
    const { pr_id, guest_email } = validatedData;

    // Récupérer le propriétaire connecté
    const host_id = request.headers.get("x-user-id");
    
    if (!host_id) {
      return NextResponse.json(
        { error: "Authentification requise" },
        { status: 401 }
      );
    }

    // Vérifier que le projet existe et appartient au propriétaire
    const project = await prisma.project.findFirst({
      where: {
        pr_id,
        owner_id: host_id,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Projet non trouvé ou vous n'êtes pas le propriétaire" },
        { status: 404 }
      );
    }

    // Trouver l'éditeur invité par email
    const guest = await prisma.user.findUnique({
      where: { email: guest_email },
    });

    if (!guest) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé avec cet email" },
        { status: 404 }
      );
    }

    // Vérifier qu'on ne s'invite pas soi-même
    if (guest.user_id === host_id) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas vous inviter vous-même" },
        { status: 400 }
      );
    }

    // Vérifier qu'une invitation n'existe pas déjà
    const existingInvitation = await prisma.invitation.findUnique({
      where: {
        pr_id_guest_id: {
          pr_id,
          guest_id: guest.user_id,
        },
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        { 
          error: "Cet utilisateur a déjà été invité sur ce projet",
          invitation: existingInvitation 
        },
        { status: 409 }
      );
    }

    // Générer un token sécurisé pour l'invitation
    const access_token = crypto.randomBytes(32).toString("hex");

    // Créer l'invitation avec le token
    const invitation = await prisma.invitation.create({
      data: {
        pr_id,
        guest_id: guest.user_id,
        host_id,
        invitation_state: "Pending",
        access_token,
      },
      include: {
        guest: {
          select: {
            user_id: true,
            email: true,
            firstname: true,
            lastname: true,
          },
        },
        host: {
          select: {
            user_id: true,
            email: true,
            firstname: true,
            lastname: true,
          },
        },
        project: {
          select: {
            pr_id: true,
            pr_name: true,
          },
        },
      },
    });

    // Créer le lien d'invitation
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const invitationLink = `${baseUrl}/projects/${pr_id}/join?token=${access_token}`;

    //TODO: Envoyer l'email avec le lien d'invitation
      await sendInvitationEmail({
      to: guest_email,
      guestName: `${guest.firstname} ${guest.lastname}`,
      hostName: invitation.host.firstname,
      projectName: project.pr_name,
      invitationLink,
     });

    return NextResponse.json(
      {
        message: `Invitation créée avec succès. Un email a été envoyé à ${guest_email}`,
        invitation,
        invitationLink, // Pour les tests, vous pouvez utiliser ce lien directement
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Erreur lors de la création de l'invitation:", error);

    // Gestion des erreurs de validation Zod
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Erreur serveur lors de la création de l'invitation" },
      { status: 500 }
    );
  }
}