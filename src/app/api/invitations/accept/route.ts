/**
 * @fileoverview Route pour accepter une invitation
 * POST /api/invitations/accept
 * 
 * @swagger
 * /api/invitations/accept:
 *   post:
 *     tags:
 *       - Invitations
 *     summary: Accepter une invitation à un projet
 *     description: |
 *       Permet à un utilisateur invité d'accepter une invitation en attente en utilisant le token reçu par email.
 *       L'utilisateur devient automatiquement éditeur du projet.
 *       IMPORTANT: Cet endpoint utilise le token de l'invitation, pas le token d'authentification utilisateur.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - access_token
 *             properties:
 *               access_token:
 *                 type: string
 *                 description: Token d'invitation reçu par email
 *                 example: "fb6600b68797a848a73bbd630ed13361c261b35638c36b63958c92d1940cd999"
 *     responses:
 *       200:
 *         description: Invitation acceptée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Invitation acceptée ! Vous êtes maintenant éditeur du projet "Mon Projet"
 *                 invitation:
 *                   type: object
 *                 project:
 *                   type: object
 *                   properties:
 *                     pr_id:
 *                       type: string
 *                     pr_name:
 *                       type: string
 *                 redirectUrl:
 *                   type: string
 *                   example: "/projects/69677cabebbbf5909b6d703b"
 *       400:
 *         description: Invitation déjà traitée ou données invalides
 *       404:
 *         description: Invitation non trouvée ou token invalide
 *       500:
 *         description: Erreur serveur
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";

// ✅ Schéma de validation simple défini LOCALEMENT (ne dépend PAS de /lib/invitation.ts)
const acceptInvitationSchema = z.object({
  access_token: z.string().min(1, "Le token d'invitation est requis").trim(),
});

/**
 * POST /api/invitations/accept
 * Accepter une invitation à un projet via le token reçu par email
 * 
 * Body: { access_token: string }
 * PAS DE HEADER REQUIS - Le token d'invitation suffit pour l'authentification
 * Returns: Invitation mise à jour avec les détails du projet
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log("📨 Tentative d'acceptation d'invitation");
    console.log("📧 Token reçu:", body.access_token?.substring(0, 20) + "...");
    
    // ✅ Validation des données avec le schéma LOCAL
    const validatedData = acceptInvitationSchema.parse(body);
    const { access_token } = validatedData;

    // Trouver l'invitation avec ce token
    const invitation = await prisma.invitation.findUnique({
      where: { access_token },
      include: {
        project: {
          select: {
            pr_id: true,
            pr_name: true,
            owner_id: true,
          },
        },
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
      },
    });

    // Vérifier que l'invitation existe
    if (!invitation) {
      console.log("❌ Invitation non trouvée avec ce token");
      return NextResponse.json(
        { 
          success: false,
          message: "Invitation invalide ou expirée. Veuillez demander un nouveau lien d'invitation." 
        },
        { status: 404 }
      );
    }

    console.log("✅ Invitation trouvée:", invitation.id);
    console.log("📊 État actuel:", invitation.invitation_state);

    // Vérifier que l'invitation est en attente
    if (invitation.invitation_state === "Accepted") {
      console.log("⚠️ Invitation déjà acceptée");
      return NextResponse.json(
        {
          success: true,
          message: `Cette invitation a déjà été acceptée le ${new Date(invitation.response_at!).toLocaleDateString('fr-FR')}. Vous pouvez accéder au projet.`,
          invitation,
          project: {
            pr_id: invitation.project.pr_id,
            pr_name: invitation.project.pr_name,
          },
          redirectUrl: `/projects/${invitation.project.pr_id}`,
        },
        { status: 200 }
      );
    }

    if (invitation.invitation_state === "Rejected") {
      console.log("❌ Invitation précédemment rejetée");
      return NextResponse.json(
        {
          success: false,
          message: "Cette invitation a été rejetée et ne peut plus être acceptée. Veuillez contacter le propriétaire du projet pour une nouvelle invitation.",
        },
        { status: 400 }
      );
    }

    // Mettre à jour l'invitation à "Accepted"
    console.log("🔄 Mise à jour de l'invitation...");
    const updatedInvitation = await prisma.invitation.update({
      where: { access_token },
      data: {
        invitation_state: "Accepted",
        response_at: new Date(),
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

    console.log("✅ Invitation acceptée avec succès");
    console.log(`👤 ${invitation.guest.firstname} ${invitation.guest.lastname} est maintenant éditeur de "${invitation.project.pr_name}"`);

    return NextResponse.json(
      {
        success: true,
        message: `Invitation acceptée ! Vous êtes maintenant éditeur du projet "${invitation.project.pr_name}"`,
        invitation: updatedInvitation,
        project: {
          pr_id: invitation.project.pr_id,
          pr_name: invitation.project.pr_name,
        },
        redirectUrl: `/projects/${invitation.project.pr_id}`,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("❌ Erreur lors de l'acceptation de l'invitation:", error);

    // Gestion des erreurs de validation Zod
    if (error.name === "ZodError") {
      return NextResponse.json(
        { 
          success: false,
          message: "Données invalides. Le token d'invitation est requis.", 
          details: error.errors 
        },
        { status: 400 }
      );
    }

    // Erreur Prisma (problème de base de données)
    if (error.code) {
      console.error("Erreur Prisma:", error.code, error.message);
      return NextResponse.json(
        {
          success: false,
          message: "Erreur de base de données. Veuillez réessayer.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        success: false,
        message: "Erreur serveur lors de l'acceptation de l'invitation. Veuillez réessayer plus tard." 
      },
      { status: 500 }
    );
  }
}