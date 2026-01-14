/**
 * @fileoverview Route pour refuser une invitation
 * POST /api/invitations/decline
 
 * @swagger
 * /api/invitations/decline:
 *   post:
 *     tags:
 *       - Invitations
 *     summary: Refuser une invitation
 *     description: Permet à un utilisateur invité de refuser une invitation à un projet
 *     security:
 *       - xUserIdAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - invitation_id
 *             properties:
 *               invitation_id:
 *                 type: string
 *                 description: ID de l'invitation à refuser
 *                 example: "65a3f1b2c9d7e81234567890"
 *     responses:
 *       200:
 *         description: Invitation refusée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Invitation refusée
 *                 invitation:
 *                   $ref: '#/components/schemas/Invitation'
 *       400:
 *         description: Données invalides ou invitation déjà traitée
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Cette invitation a déjà été acceptée
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
 *       403:
 *         description: Action non autorisée (l'utilisateur n'est pas l'invité)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Vous n'êtes pas autorisé à refuser cette invitation
 *       404:
 *         description: Invitation non trouvée
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invitation non trouvée
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Erreur serveur lors du refus de l'invitation
 *
 * @swagger
 * components:
 *   securitySchemes:
 *     xUserIdAuth:
 *       type: apiKey
 *       in: header
 *       name: x-user-id
 */

 
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { respondInvitationSchema } from "@/lib/invitation";

/**
 * POST /api/invitations/decline
 * Refuser une invitation à un projet
 * 
 * Body: { invitation_id: string }
 * Headers: x-user-id (ID de l'utilisateur connecté)
 * Returns: Invitation mise à jour
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validation
    const validatedData = respondInvitationSchema.parse(body);
    const { invitation_id } = validatedData;

    // Récupérer l'utilisateur connecté
    const user_id = request.headers.get("x-user-id");
    
    if (!user_id) {
      return NextResponse.json(
        { error: "Authentification requise" },
        { status: 401 }
      );
    }

    // Vérifier que l'invitation existe
    const invitation = await prisma.invitation.findUnique({
      where: { id: invitation_id },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation non trouvée" },
        { status: 404 }
      );
    }

    // Vérifier que l'utilisateur est bien l'invité
    if (invitation.guest_id !== user_id) {
      return NextResponse.json(
        { error: "Vous n'êtes pas autorisé à refuser cette invitation" },
        { status: 403 }
      );
    }

    // Vérifier que l'invitation est en attente
    if (invitation.invitation_state !== "Pending") {
      return NextResponse.json(
        { 
          error: `Cette invitation a déjà été ${invitation.invitation_state === "Accepted" ? "acceptée" : "refusée"}` 
        },
        { status: 400 }
      );
    }

    // Mettre à jour l'invitation
    const updatedInvitation = await prisma.invitation.update({
      where: { id: invitation_id },
      data: {
        invitation_state: "Rejected",
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

    return NextResponse.json(
      {
        message: "Invitation refusée",
        invitation: updatedInvitation,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Erreur lors du refus de l'invitation:", error);

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Erreur serveur lors du refus de l'invitation" },
      { status: 500 }
    );
  }
}