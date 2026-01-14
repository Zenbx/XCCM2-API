/**
 * @swagger
 * /api/projects/{pr_name}/invitations/email:
 *   post:
 *     tags:
 *       - Invitations
 *     summary: Inviter un collaborateur par email
 *     description: "Envoie une invitation de collaboration par email. Un seul collaborateur par projet."
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pr_name
 *         required: true
 *         schema:
 *           type: string
 *         description: "Nom du projet"
 *         example: "Mon Super Projet"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - guestEmail
 *             properties:
 *               guestEmail:
 *                 type: string
 *                 format: email
 *                 example: collaborator@example.com
 *                 description: "Email de la personne à inviter"
 *     responses:
 *       201:
 *         description: "Invitation envoyée avec succès"
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
 *                   example: "Invitation envoyée avec succès"
 *                 data:
 *                   type: object
 *                   properties:
 *                     invitation:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         guest_email:
 *                           type: string
 *                         token:
 *                           type: string
 *                         status:
 *                           type: string
 *                           enum: [Pending, Accepted, Rejected]
 *       400:
 *         description: "Email invalide ou utilisateur inexistant"
 *       401:
 *         description: "Non authentifié"
 *       403:
 *         description: "Vous n'êtes pas le créateur de ce projet"
 *       404:
 *         description: "Projet ou utilisateur non trouvé"
 *       409:
 *         description: "Un collaborateur est déjà assigné à ce projet"
 *       500:
 *         description: "Erreur serveur (ex: email non envoyé)"
 */

// Export vide pour que TypeScript compile ce fichier
export const emailSwaggerDocs = {};
