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
        // Détection du type de contenu (JSON ou FormData)
        const contentType = request.headers.get("content-type") || "";
        const isFormData = contentType.includes("multipart/form-data");

        let body: any;
        let profilePictureFile: File | null = null;

        if (isFormData) {
            // Traitement FormData (avec fichier)
            const formData = await request.formData();
            body = {
                email: formData.get("email"),
                password: formData.get("password"),
                password_confirmation: formData.get("password_confirmation"),
                lastname: formData.get("lastname"),
                firstname: formData.get("firstname"),
                org: formData.get("org") || null,
                occupation: formData.get("occupation") || null,
            };
            profilePictureFile = formData.get("profile_picture") as File | null;
        } else {
            // Traitement JSON (sans fichier)
            body = await request.json();
            profilePictureFile = null;
        }

        // Validation
        if (body.password !== body.password_confirmation) {
            return errorResponse("Les mots de passe ne correspondent pas", undefined, 400);
        }

        const validatedData = registerSchema.parse(body);

        const existingUser = await prisma.user.findUnique({
            where: { email: validatedData.email },
        });

        if (existingUser) {
            return errorResponse("Cet email est déjà utilisé", undefined, 409);
        }

        // Handle File Upload
        let profilePicturePath = null;
        if (profilePictureFile && profilePictureFile.size > 0) {
            // Validate file type
            if (!profilePictureFile.type.startsWith("image/")) {
                return errorResponse("Le fichier doit être une image", undefined, 400);
            }
            // Validate size (e.g., 5MB)
            if (profilePictureFile.size > 5 * 1024 * 1024) {
                return errorResponse("L'image ne doit pas dépasser 5 Mo", undefined, 400);
            }

            // Save file
            const { saveProfilePicture } = await import("@/lib/storage");
            profilePicturePath = await saveProfilePicture(profilePictureFile);
        }

        const hashedPassword = await hashPassword(validatedData.password);

        const user = await prisma.user.create({
            data: {
                email: validatedData.email,
                password: hashedPassword,
                lastname: validatedData.lastname,
                firstname: validatedData.firstname,
                org: validatedData.org || null,
                occupation: validatedData.occupation || null,
                profile_picture: profilePicturePath,
            },
        });

        const publicUser = toPublicUser(user);
        const token = await generateToken(publicUser);

        return successResponse(
            "Utilisateur créé avec succès",
            { user: publicUser, token },
            201
        );
    } catch (error) {
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
        console.error("Erreur lors de l'inscription:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de l'inscription",
            error instanceof Error ? error.message : undefined
        );
    }
}