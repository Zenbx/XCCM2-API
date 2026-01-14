/**
 * @fileoverview Route API pour l'abonnement à la newsletter
 * Gère l'abonnement des utilisateurs à la newsletter via email
 *
 * @swagger
 * /api/newsletter/subscribe:
 *   post:
 *     tags:
 *       - Newsletter
 *     summary: S'abonner à la newsletter
 *     description: Permet à un utilisateur de s'abonner à la newsletter. Un email de confirmation sera envoyé immédiatement.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john.doe@example.com
 *     responses:
 *       200:
 *         description: Abonnement réussi, email de confirmation envoyé
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
 *                   example: Abonnement réussi. Un email de confirmation a été envoyé.
 *       400:
 *         description: Email invalide
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
import { newsletterSubscribeSchema } from "@/utils/validation";
import {
    successResponse,
    validationErrorResponse,
    serverErrorResponse,
} from "@/utils/api-response";
import { sendNewsletterConfirmation } from "@/lib/email";
import { ZodError } from "zod";

/**
 * Handler POST pour l'abonnement à la newsletter
 * @param request - Requête Next.js
 * @returns Réponse JSON avec statut de succès
 */
export async function POST(request: NextRequest) {
    try {
        // Parse le body de la requête
        const body = await request.json();

        // Validation avec Zod
        const validatedData = newsletterSubscribeSchema.parse(body);

        // Envoie l'email de confirmation
        await sendNewsletterConfirmation(validatedData.email);

        // Retourne la réponse de succès
        return successResponse(
            "Abonnement réussi. Un email de confirmation a été envoyé.",
            {
                email: validatedData.email,
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
        console.error("Erreur lors de l'abonnement à la newsletter:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de l'abonnement à la newsletter",
            error instanceof Error ? error.message : undefined
        );
    }
}
