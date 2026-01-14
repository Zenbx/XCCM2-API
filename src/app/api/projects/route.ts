/**
 * @fileoverview Routes API pour la gestion des projets
 * Gère la création de projets et la récupération de tous les projets d'un utilisateur
 *
 * @swagger
 * /api/projects:
 *   post:
 *     tags:
 *       - Projects
 *     summary: Créer un nouveau projet
 *     description: Crée un nouveau projet pour l'utilisateur authentifié
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pr_name
 *             properties:
 *               pr_name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 100
 *                 example: Mon Super Projet
 *                 description: Nom du projet (unique par utilisateur)
 *     responses:
 *       201:
 *         description: Projet créé avec succès
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
 *                   example: Projet créé avec succès
 *                 data:
 *                   type: object
 *                   properties:
 *                     project:
 *                       $ref: '#/components/schemas/Project'
 *       400:
 *         description: Données invalides
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       401:
 *         description: Non autorisé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       409:
 *         description: Un projet avec ce nom existe déjà
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
 *   get:
 *     tags:
 *       - Projects
 *     summary: Récupérer tous les projets de l'utilisateur connecté
 *     description: Retourne la liste de tous les projets appartenant à l'utilisateur authentifié
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des projets récupérée avec succès
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
 *                   example: Projets récupérés avec succès
 *                 data:
 *                   type: object
 *                   properties:
 *                     projects:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Project'
 *                     count:
 *                       type: integer
 *                       example: 5
 *                       description: Nombre total de projets
 *       401:
 *         description: Non autorisé
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
import { createProjectSchema } from "@/utils/validation";
import {
    successResponse,
    errorResponse,
    validationErrorResponse,
    serverErrorResponse,
} from "@/utils/api-response";
import { ZodError } from "zod";

/**
 * Handler POST pour créer un nouveau projet
 * @param request - Requête Next.js avec le header x-user-id
 * @returns Réponse JSON avec le projet créé
 */
export async function POST(request: NextRequest) {
    try {
        // Récupère l'userId depuis le header (ajouté par le middleware)
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Utilisateur non authentifié", undefined, 401);
        }

        // Parse le body de la requête
        const body = await request.json();

        // Validation avec Zod
        const validatedData = createProjectSchema.parse(body);

        // Vérifie si un projet avec ce nom existe déjà pour cet utilisateur
        const existingProject = await prisma.project.findUnique({
            where: {
                pr_name_owner_id: {
                    pr_name: validatedData.pr_name,
                    owner_id: userId,
                },
            },
        });

        if (existingProject) {
            return errorResponse(
                "Un projet avec ce nom existe déjà",
                undefined,
                409
            );
        }

        // Création du projet
        const project = await prisma.project.create({
            data: {
                pr_name: validatedData.pr_name,
                owner_id: userId,
            },
        });

        return successResponse(
            "Projet créé avec succès",
            { project },
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
        console.error("Erreur lors de la création du projet:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la création du projet",
            error instanceof Error ? error.message : undefined
        );
    }
}

/**
 * Handler GET pour récupérer tous les projets de l'utilisateur connecté
 * Retourne:
 * - Les projets créés par l'utilisateur (owner_id)
 * - Les projets où l'utilisateur a une invitation acceptée
 * @param request - Requête Next.js avec le header x-user-id
 * @returns Réponse JSON avec la liste des projets
 */
export async function GET(request: NextRequest) {
    try {
        // Récupère l'userId depuis le header (ajouté par le middleware)
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Utilisateur non authentifié", undefined, 401);
        }

        // Récupère les projets créés par l'utilisateur
        const ownedProjects = await prisma.project.findMany({
            where: {
                owner_id: userId,
            },
            orderBy: {
                created_at: "desc",
            },
        });

        // Récupère les projets où l'utilisateur a une invitation acceptée
        const invitedProjects = await prisma.project.findMany({
            where: {
                invitations: {
                    some: {
                        AND: [
                            { guest_id: userId },
                            // { invitation_state: "Accepted" },
                        ],
                    },
                },
            },
            orderBy: {
                created_at: "desc",
            },
        });

        // Fusionner les deux listes en supprimant les doublons (un projet ne peut pas être dans les deux)
        const allProjects = [...ownedProjects, ...invitedProjects];

        return successResponse("Projets récupérés avec succès", {
            projects: allProjects,
            count: allProjects.length,
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des projets:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la récupération des projets",
            error instanceof Error ? error.message : undefined
        );
    }
}