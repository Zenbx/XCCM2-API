/**
 * @fileoverview Route API pour la connexion des utilisateurs
 * Gère l'authentification et la génération de tokens JWT
 *
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Connexion d'un utilisateur
 *     description: Authentifie un utilisateur avec email et mot de passe, retourne un token JWT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john.doe@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePass123
 *               password_confirmation:
 *                 type: string
 *                 format: password
 *                 example: SecurePass123
 *     responses:
 *       200:
 *         description: Connexion réussie
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
 *                   example: Connexion réussie
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     token:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       401:
 *         description: Identifiants incorrects
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
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPassword, generateToken, toPublicUser } from "@/lib/auth";
import { loginSchema } from "@/utils/validation";
import {
    successResponse,
    unauthorizedResponse,
    validationErrorResponse,
    serverErrorResponse, errorResponse,
} from "@/utils/api-response";
import { ZodError } from "zod";

/**
 * Handler POST pour la connexion d'un utilisateur
 * @param request - Requête Next.js
 * @returns Réponse JSON avec l'utilisateur et le token JWT
 */
export async function POST(request: NextRequest) {
    try {
        // Parse le body de la requête
        const body = await request.json();

        //Comparaison des mots de passe
        //if (body.password !== body.password_confirmation) {
            //return { error: "Passwords do not match" };
          //  return errorResponse("Les mots de passe ne correspondent pas", undefined, 400);
        //}

        // Validation avec Zod
        const validatedData = loginSchema.parse(body);

        // Recherche l'utilisateur par email
        const user = await prisma.user.findUnique({
            where: { email: validatedData.email },
        });

        if (!user) {
            return unauthorizedResponse("Email ou mot de passe incorrect");
        }

        // Vérifie le mot de passe
        const isPasswordValid = await verifyPassword(
            validatedData.password,
            user.password
        );

        if (!isPasswordValid) {
            return unauthorizedResponse("Email ou mot de passe incorrect");
        }

        // Convertit en utilisateur public
        const publicUser = toPublicUser(user);

        // Génère le token JWT
        const token = await generateToken(publicUser);

        // Retourne la réponse de succès
        return successResponse("Connexion réussie", {
            user: publicUser,
            token,
        });
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
        console.error("Erreur lors de la connexion:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la connexion",
            error instanceof Error ? error.message : undefined
        );
    }
}