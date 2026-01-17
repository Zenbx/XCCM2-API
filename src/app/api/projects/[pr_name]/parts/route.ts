/**
 * @fileoverview Routes API pour la gestion des parties (Parts)
 * Gère la création et la récupération de toutes les parties d'un projet
 *
 * @swagger
 * /api/projects/{pr_name}/parts:
 *   post:
 *     tags:
 *       - Parts
 *     summary: Créer une nouvelle partie
 *     description: Crée une nouvelle partie dans un projet avec renumérotation automatique
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pr_name
 *         required: true
 *         schema:
 *           type: string
 *         description: Nom du projet
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - part_title
 *               - part_number
 *             properties:
 *               part_title:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 200
 *                 example: Introduction
 *               part_intro:
 *                 type: string
 *                 example: Cette partie présente les concepts de base
 *               part_number:
 *                 type: integer
 *                 minimum: 1
 *                 example: 1
 *     responses:
 *       201:
 *         description: Partie créée avec succès
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
 *                   example: Partie créée avec succès
 *                 data:
 *                   type: object
 *                   properties:
 *                     part:
 *                       $ref: '#/components/schemas/Part'
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Projet non trouvé
 *       409:
 *         description: Une partie avec ce titre existe déjà
 *       422:
 *         description: Erreur de validation
 *       500:
 *         description: Erreur serveur
 *   get:
 *     tags:
 *       - Parts
 *     summary: Récupérer toutes les parties d'un projet
 *     description: Retourne la liste de toutes les parties d'un projet, triées par numéro
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pr_name
 *         required: true
 *         schema:
 *           type: string
 *         description: Nom du projet
 *     responses:
 *       200:
 *         description: Parties récupérées avec succès
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
 *                   example: Parties récupérées avec succès
 *                 data:
 *                   type: object
 *                   properties:
 *                     parts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Part'
 *                     count:
 *                       type: integer
 *                       example: 3
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Projet non trouvé
 *       500:
 *         description: Erreur serveur
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { createPartSchema } from "@/utils/validation";
//import { renumberPartsAfterInsert } from "@/utils/granule-helpers";
import {
    successResponse,
    errorResponse,
    notFoundResponse,
    validationErrorResponse,
    serverErrorResponse,
} from "@/utils/api-response";
import { ZodError } from "zod";

type RouteParams = {
    params: Promise<{ pr_name: string }>;
};

/**
 * Handler POST pour créer une nouvelle partie
 * @param request - Requête Next.js
 * @param context - Contexte avec les paramètres de route
 * @returns Réponse JSON avec la partie créée
 */
export async function POST(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Utilisateur non authentifié", undefined, 401);
        }

        const { pr_name: encodedName } = await context.params;
        const pr_name = decodeURIComponent(encodedName);

        // Vérifie que le projet existe et que l'utilisateur y a accès
        const project = await prisma.project.findFirst({
            where: {
                pr_name: pr_name,
                OR: [
                    { owner_id: userId },
                    {
                        invitations: {
                            some: {
                                guest_id: userId,
                                invitation_state: "Accepted"
                            }
                        }
                    }
                ]
            },
        });

        if (!project) {
            return notFoundResponse("Projet non trouvé");
        }

        const body = await request.json();
        const validatedData = createPartSchema.parse(body);

        // Vérifie si une partie avec ce titre existe déjà dans ce projet
        const existingPart = await prisma.part.findUnique({
            where: {
                part_title_parent_pr: {
                    part_title: validatedData.part_title,
                    parent_pr: project.pr_id,
                },
            },
        });

        if (existingPart) {
            return errorResponse(
                "Une partie avec ce titre existe déjà dans ce projet",
                undefined,
                409
            );
        }

        // Vérifie si le numéro est déjà pris
        const existingNumber = await prisma.part.findUnique({
            where: {
                part_number_parent_pr: {
                    part_number: validatedData.part_number,
                    parent_pr: project.pr_id,
                },
            },
        });


        // Si le numéro existe, on retourne une réponse 409
        if (existingNumber) {
            return errorResponse(
                "Une partie avec ce numéro existe déjà dans ce projet",
                undefined,
                409
            );
        }

        //Vérifier si le numéro est logique

        //On récupère le nombre de parties
        const countParts = await prisma.part.count({
            where: {
                parent_pr: project.pr_id // L'ID doit être un string (ObjectId)
            }
        });

        //Le numéro de la nouvelle partie doit etre le successeur de countParts
        if (validatedData.part_number !== countParts + 1) {
            return errorResponse(
                "Votre projet ne compte que " + countParts
                + " parties du cou votre numéro de partie est illogique",
                undefined,
                409
            );
        }


        // Création de la partie
        const part = await prisma.part.create({
            data: {
                part_title: validatedData.part_title,
                part_intro: validatedData.part_intro || null,
                part_number: validatedData.part_number,
                parent_pr: project.pr_id,
                owner_id: userId,
            },
        });

        return successResponse("Partie créée avec succès", { part }, 201);
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

        console.error("Erreur lors de la création de la partie:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la création de la partie",
            error instanceof Error ? error.message : undefined
        );
    }
}

/**
 * Handler GET pour récupérer toutes les parties d'un projet
 * @param request - Requête Next.js
 * @param context - Contexte avec les paramètres de route
 * @returns Réponse JSON avec la liste des parties
 */
export async function GET(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Utilisateur non authentifié", undefined, 401);
        }

        const { pr_name: encodedName } = await context.params;
        const pr_name = decodeURIComponent(encodedName);

        // Vérifie que le projet existe et que l'utilisateur y a accès
        const project = await prisma.project.findFirst({
            where: {
                pr_name: pr_name,
                OR: [
                    { owner_id: userId },
                    {
                        invitations: {
                            some: {
                                guest_id: userId,
                                invitation_state: "Accepted"
                            }
                        }
                    }
                ]
            },
        });

        if (!project) {
            return notFoundResponse("Projet non trouvé");
        }

        // Récupère toutes les parties du projet, triées par numéro
        const parts = await prisma.part.findMany({
            where: {
                parent_pr: project.pr_id,
            },
            orderBy: {
                part_number: "asc",
            },
        });

        return successResponse("Parties récupérées avec succès", {
            parts,
            count: parts.length,
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des parties:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la récupération des parties",
            error instanceof Error ? error.message : undefined
        );
    }
}