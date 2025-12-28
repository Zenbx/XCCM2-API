/**
 * @fileoverview Route API pour l'inscription des utilisateurs
 * Gère la création de nouveaux comptes utilisateur avec validation
 *
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Inscription d'un nouvel utilisateur
 *     description: Crée un nouveau compte utilisateur avec email, mot de passe et informations personnelles
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - password_confirmation
 *               - lastname
 *               - firstname
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john.doe@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: SecurePass123
 *                 description: Doit contenir au moins une majuscule, une minuscule et un chiffre
 *               password_confirmation:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: SecurePass123
 *                 description: Doit contenir au moins une majuscule, une minuscule et un chiffre
 *               lastname:
 *                 type: string
 *                 minLength: 2
 *                 example: Doe
 *               firstname:
 *                 type: string
 *                 minLength: 2
 *                 example: John
 *               org:
 *                 type: string
 *                 example: XCCM Inc.
 *                 description: Organisation (optionnel)
 *               occupation:
 *                 type: string
 *                 example: Développeur Full-Stack
 *                 description: Métier/Occupation (optionnel)
 *     responses:
 *       201:
 *         description: Utilisateur créé avec succès
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
 *                   example: Utilisateur créé avec succès
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     token:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       400:
 *         description: Données invalides
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       409:
 *         description: Email déjà utilisé
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
import { hashPassword, generateToken, toPublicUser } from "@/lib/auth";
import { registerSchema } from "@/utils/validation";
import {
    successResponse,
    errorResponse,
    validationErrorResponse,
    serverErrorResponse,
} from "@/utils/api-response";
import { ZodError } from "zod";

/**
 * Handler POST pour l'inscription d'un utilisateur
 * @param request - Requête Next.js
 * @returns Réponse JSON avec l'utilisateur créé et le token JWT
 */
export async function POST(request: NextRequest) {
    try {
        // Parse le body de la requête
        const body = await request.json();
        console.log(body);
        //Comparaison des mots de passe
        if (body.password !== body.password_confirmation) {
            //return { error: "Passwords do not match" };
            return errorResponse("Les mots de passe ne correspondent pas", undefined, 400);
        }

        // Validation avec Zod
        const validatedData = registerSchema.parse(body);

        // Vérifie si l'email existe déjà
        const existingUser = await prisma.user.findUnique({
            where: { email: validatedData.email },
        });

        if (existingUser) {
            return errorResponse("Cet email est déjà utilisé", undefined, 409);
        }

        // Hash du mot de passe
        const hashedPassword = await hashPassword(validatedData.password);

        // Création de l'utilisateur
        const user = await prisma.user.create({
            data: {
                email: validatedData.email,
                password: hashedPassword,
                lastname: validatedData.lastname,
                firstname: validatedData.firstname,
                org: validatedData.org || null,
                occupation: validatedData.occupation || null,
            },
        });

        // Convertit en utilisateur public (sans le mot de passe)
        const publicUser = toPublicUser(user);

        // Génère le token JWT
        const token = await generateToken(publicUser);

        // Retourne la réponse de succès
        return successResponse(
            "Utilisateur créé avec succès",
            {
                user: publicUser,
                token,
            },
            201
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
        console.error("Erreur lors de l'inscription:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de l'inscription",
            error instanceof Error ? error.message : undefined
        );
    }
}