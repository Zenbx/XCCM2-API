/**
 * @fileoverview Routes API pour une invitation spécifique
 * Gère la récupération et la suppression d'une invitation par son ID
 *
 * @swagger
 * /api/invitations/{invitation_id}:
 *   get:
 *     tags:
 *       - Invitations
 *     summary: Récupérer une invitation spécifique
 *     description: Récupère les détails d'une invitation par son ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invitation_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'invitation
 *         example: "clx9876543210zyxwvuts"
 *     responses:
 *       200:
 *         description: Invitation récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 invitation:
 *                   $ref: '#/components/schemas/Invitation'
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
 *         description: Accès non autorisé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Accès non autorisé à cette invitation
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
 *                   example: Erreur serveur lors de la récupération de l'invitation
 *   delete:
 *     tags:
 *       - Invitations
 *     summary: Supprimer une invitation
 *     description: Supprimer/annuler une invitation. Seul l'hôte peut supprimer une invitation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invitation_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'invitation à supprimer
 *         example: "clx9876543210zyxwvuts"
 *     responses:
 *       200:
 *         description: Invitation supprimée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Invitation supprimée avec succès
 *                 deleted_invitation_id:
 *                   type: string
 *                   example: "clx9876543210zyxwvuts"
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
 *         description: Accès non autorisé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Seul l'hôte peut supprimer cette invitation
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
 *                   example: Erreur serveur lors de la suppression de l'invitation
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/invitations/[invitation_id]
 * Récupérer les détails d'une invitation spécifique
 * 
 * Headers: x-user-id (ID de l'utilisateur connecté)
 * Params: invitation_id
 * Returns: Détails de l'invitation
export async function GET(
  request: NextRequest,
  { params }: { params: { invitation_id: string } }
) {
  try {
    const { invitation_id } = params;

    // Récupérer l'utilisateur connecté
    const user_id = request.headers.get("x-user-id");
    
    if (!user_id) {
      return NextResponse.json(
        { error: "Authentification requise" },
        { status: 401 }
      );
    }

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitation_id },
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
            owner_id: true,
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation non trouvée" },
        { status: 404 }
      );
    }

    // Vérifier que l'utilisateur a le droit de voir cette invitation
    if (invitation.guest_id !== user_id && invitation.host_id !== user_id) {
      return NextResponse.json(
        { error: "Accès non autorisé à cette invitation" },
        { status: 403 }
      );
    }

    return NextResponse.json({ invitation }, { status: 200 });
  } catch (error: any) {
    console.error("Erreur lors de la récupération de l'invitation:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la récupération de l'invitation" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/invitations/[invitation_id]
 * Supprimer/annuler une invitation
 * Seul l'hôte peut supprimer une invitation
 * 
 * Headers: x-user-id (ID de l'utilisateur connecté)
 * Params: invitation_id
 * Returns: Message de confirmation
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { invitation_id: string } }
) {
  try {
    const { invitation_id } = params;

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

    // Vérifier que l'utilisateur est l'hôte de l'invitation
    if (invitation.host_id !== user_id) {
      return NextResponse.json(
        { error: "Seul l'hôte peut supprimer cette invitation" },
        { status: 403 }
      );
    }

    // Supprimer l'invitation
    await prisma.invitation.delete({
      where: { id: invitation_id },
    });

    return NextResponse.json(
      { 
        message: "Invitation supprimée avec succès",
        deleted_invitation_id: invitation_id
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Erreur lors de la suppression de l'invitation:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la suppression de l'invitation" },
      { status: 500 }
    );
  }
}