/**
 * @fileoverview Route API pour l'inscription des utilisateurs
 * Gère la création de nouveaux comptes utilisateur avec validation
 *
 */
/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Inscription d'un nouvel utilisateur
 *     description: Crée un nouveau compte utilisateur. Support JSON ou Multipart/Form-Data.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, lastname, firstname]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *               lastname: { type: string }
 *               firstname: { type: string }
 *               org: { type: string }
 *               occupation: { type: string }
 *               profile_picture: { type: string, format: binary, description: 'Seulement pour multipart/form-data' }
 *     responses:
 *       201:
 *         description: Utilisateur créé avec succès
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { hashPassword, generateToken, toPublicUser } from "@/lib/auth";
import { registerSchema } from "@/utils/validation";
import {
    successResponse,
    errorResponse,
    validationErrorResponse,
    serverErrorResponse,
} from "@/utils/api-response";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { ZodError } from "zod";

/**
 * Handler POST pour l'inscription d'un utilisateur
 * @param request - Requête Next.js
 * @returns Réponse JSON avec l'utilisateur créé et le token JWT
 */
export async function POST(request: NextRequest) {
    try {
        // 3 inscriptions max par IP par heure
        const ip = getClientIp(request);
        const rl = await rateLimit(`register:${ip}`, 3, 60 * 60);
        if (!rl.allowed) {
            return errorResponse("Trop d'inscriptions depuis cette adresse. Réessayez dans 1 heure.", undefined, 429);
        }
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
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            return serverErrorResponse(
                "Erreur base de données lors de l'inscription",
                `Prisma ${error.code}: ${error.message}`
            );
        }
        if (error instanceof Prisma.PrismaClientInitializationError) {
            return serverErrorResponse(
                "Impossible de se connecter à la base de données",
                error.message
            );
        }
        return serverErrorResponse(
            "Une erreur est survenue lors de l'inscription",
            error instanceof Error ? error.message : String(error)
        );
    }
}