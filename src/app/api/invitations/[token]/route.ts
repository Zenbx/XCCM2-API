/**
 * @fileoverview Documentation Swagger pour les routes d'invitations via token
 * Les implémentations sont dans les fichiers natifs:
 * - accept/route.ts
 * - decline/route.ts
 * - revoke/route.ts
 *
 * @swagger
 * /api/invitations/{token}/accept:
 *   patch:
 *     tags:
 *       - Invitations
 *     summary: Accepter une invitation
 *     description: Accepte une invitation et redirige l'utilisateur vers la page d'édition du projet
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Token de l'invitation
 *         example: abc123def456xyz789
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
 *                   example: Invitation acceptée avec succès
 *                 data:
 *                   type: object
 *                   properties:
 *                     invitation:
 *                       $ref: '#/components/schemas/Invitation'
 *                     redirect_url:
 *                       type: string
 *                       example: /projects/Mon%20Super%20Projet/edit
 *                       description: URL de redirection vers la page d'édition
 *       401:
 *         description: Non autorisé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       403:
 *         description: Vous n'êtes pas le destinataire de cette invitation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         description: Invitation non trouvée
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       410:
 *         description: Invitation déjà traitée
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *
 * /api/invitations/{token}/decline:
 *   patch:
 *     tags:
 *       - Invitations
 *     summary: Décliner une invitation
 *     description: Décline une invitation de collaboration sur un projet
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Token de l'invitation
 *         example: abc123def456xyz789
 *     responses:
 *       200:
 *         description: Invitation déclinée avec succès
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
 *                   example: Invitation déclinée
 *                 data:
 *                   type: object
 *                   properties:
 *                     invitation:
 *                       $ref: '#/components/schemas/Invitation'
 *       401:
 *         description: Non autorisé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       403:
 *         description: Vous n'êtes pas le destinataire de cette invitation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         description: Invitation non trouvée
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       410:
 *         description: Invitation déjà traitée
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *
 * /api/invitations/{token}/revoke:
 *   delete:
 *     tags:
 *       - Invitations
 *     summary: Révoquer une invitation
 *     description: "Permet au créateur du projet (host) d'annuler une invitation avant qu'elle ne soit acceptée. Seul le créateur du projet peut révoquer l'invitation."
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: "Token d'invitation unique"
 *         example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: "Invitation révoquée avec succès"
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
 *                   example: "Invitation révoquée avec succès"
 *                 data:
 *                   type: object
 *                   properties:
 *                     invitation_id:
 *                       type: string
 *                       description: "ID de l'invitation révoquée"
 *                       example: "507f1f77bcf86cd799439011"
 *                     project_name:
 *                       type: string
 *                       description: "Nom du projet"
 *                       example: "Mon Super Projet"
 *       400:
 *         description: "L'invitation ne peut pas être révoquée (déjà acceptée ou déclinée)"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Impossible de révoquer une invitation déjà acceptée"
 *       401:
 *         description: "Non authentifié ou token invalide"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Non authentifié"
 *       403:
 *         description: "Vous n'êtes pas autorisé à révoquer cette invitation"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Vous n'êtes pas autorisé à révoquer cette invitation"
 *       404:
 *         description: "Invitation non trouvée"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Invitation non trouvée"
 *       500:
 *         description: "Erreur serveur"
 */

// Export vide pour que TypeScript compile ce fichier avec les annotations Swagger
export const invitationRouteDocs = {};