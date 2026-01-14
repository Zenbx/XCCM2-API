/**
 * @fileoverview Route API pour le formulaire de contact
 * Gère les messages de contact et envoie des confirmations
 *
 * @swagger
 * /api/contact:
 *   post:
 *     tags:
 *       - Contact
 *     summary: Envoyer un message de contact
 *     description: Permet aux visiteurs d'envoyer un message à l'équipe technique. Un email de confirmation sera envoyé immédiatement.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - name
 *               - subject
 *               - message
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john.doe@example.com
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 example: John Doe
 *               subject:
 *                 type: string
 *                 minLength: 5
 *                 maxLength: 200
 *                 example: Demande d'information
 *               message:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 5000
 *                 example: Bonjour, je souhaite avoir des informations sur vos services...
 *     responses:
 *       200:
 *         description: Message envoyé avec succès
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
 *                   example: Votre message a été envoyé avec succès. Nous vous recontacterons dans les plus brefs délais.
 *       400:
 *         description: Données invalides
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       422:
 *         description: Erreur de validation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       500:
 *         description: Erreur serveur lors de l'envoi de l'email
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */

import { NextRequest } from "next/server";
import { contactSchema } from "@/utils/validation";
import {
    successResponse,
    validationErrorResponse,
    serverErrorResponse,
} from "@/utils/api-response";
import { sendContactConfirmation, sendContactToTeam } from "@/lib/email";
import { ZodError } from "zod";

/**
 * Handler POST pour l'envoi d'un message de contact
 * Envoie simultanément une confirmation au visiteur et le message à l'équipe
 * @param request - Requête Next.js
 * @returns Réponse JSON avec statut de succès
 */
export async function POST(request: NextRequest) {
    try {
        // Parse le body de la requête
        const body = await request.json();

        // Validation avec Zod
        const validatedData = contactSchema.parse(body);

        // Envoie les deux emails en parallèle
        await Promise.all([
            sendContactConfirmation(
                validatedData.email,
                validatedData.name,
                validatedData.subject
            ),
            sendContactToTeam(
                validatedData.email,
                validatedData.name,
                validatedData.subject,
                validatedData.message
            ),
        ]);

        // Retourne la réponse de succès
        return successResponse(
            "Votre message a été envoyé avec succès. Nous vous recontacterons dans les plus brefs délais.",
            {
                email: validatedData.email,
                name: validatedData.name,
            },
            200
        );
    } catch (error) {
        // Gestion des erreurs de validation Zod
        if (error instanceof ZodError) {
            const errors: Record<string, string[]> = {};
            error.issues.forEach((err) => {
                const field = err.path.join(".");
                if (!errors[field]) {
                    errors[field] = [];
                }
                errors[field].push(err.message);
            });
            return validationErrorResponse(errors);
        }

        // Erreur serveur générique
        console.error("Erreur lors de l'envoi du message de contact:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de l'envoi de votre message",
            error instanceof Error ? error.message : undefined
        );
    }
}
