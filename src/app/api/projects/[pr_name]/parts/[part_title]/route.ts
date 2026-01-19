/**
 * @fileoverview Routes API pour une partie spécifique
 * Gère la récupération, modification et suppression d'une partie par son titre
 *
 * @swagger
 * /api/projects/{pr_name}/parts/{part_title}:
 *   get:
 *     tags:
 *       - Parts
 *     summary: Récupérer une partie spécifique
 *     description: Récupère une partie par son titre
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pr_name
 *         required: true
 *         schema:
 *           type: string
 *         description: Nom du projet
 *       - in: path
 *         name: part_title
 *         required: true
 *         schema:
 *           type: string
 *         description: Titre de la partie
 *     responses:
 *       200:
 *         description: Partie récupérée avec succès
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
 *                   example: Partie récupérée avec succès
 *                 data:
 *                   type: object
 *                   properties:
 *                     part:
 *                       $ref: '#/components/schemas/Part'
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Partie non trouvée
 *       500:
 *         description: Erreur serveur
 *   patch:
 *     tags:
 *       - Parts
 *     summary: Modifier une partie
 *     description: Met à jour le titre, l'introduction ou le numéro d'une partie
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pr_name
 *         required: true
 *         schema:
 *           type: string
 *         description: Nom du projet
 *       - in: path
 *         name: part_title
 *         required: true
 *         schema:
 *           type: string
 *         description: Titre actuel de la partie
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               part_title:
 *                 type: string
 *                 example: Introduction Révisée
 *               part_intro:
 *                 type: string
 *                 example: Nouvelle introduction
 *               part_number:
 *                 type: integer
 *                 example: 2
 *     responses:
 *       200:
 *         description: Partie modifiée avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Partie non trouvée
 *       409:
 *         description: Conflit (titre ou numéro déjà utilisé)
 *       422:
 *         description: Erreur de validation
 *       500:
 *         description: Erreur serveur
 *   delete:
 *     tags:
 *       - Parts
 *     summary: Supprimer une partie
 *     description: Supprime une partie et renuméroie automatiquement les autres
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pr_name
 *         required: true
 *         schema:
 *           type: string
 *         description: Nom du projet
 *       - in: path
 *         name: part_title
 *         required: true
 *         schema:
 *           type: string
 *         description: Titre de la partie à supprimer
 *     responses:
 *       200:
 *         description: Partie supprimée avec succès
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Partie non trouvée
 *       500:
 *         description: Erreur serveur
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { updatePartSchema } from "@/utils/validation";
import { realtimeService } from "@/services/realtime-service";
import {
    renumberPartsAfterDelete,
    renumberPartsAfterUpdate,
} from "@/utils/granule-helpers";
import {
    successResponse,
    errorResponse,
    notFoundResponse,
    validationErrorResponse,
    serverErrorResponse,
} from "@/utils/api-response";
import { ZodError } from "zod";

type RouteParams = {
    params: Promise<{ pr_name: string; part_title: string }>;
};

/**
 * Handler GET pour récupérer une partie spécifique
 * @param request - Requête Next.js
 * @param context - Contexte avec les paramètres de route
 * @returns Réponse JSON avec la partie
 */
export async function GET(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Utilisateur non authentifié", undefined, 401);
        }

        const { pr_name: encodedPrName, part_title: encodedPartTitle } =
            await context.params;
        const pr_name = decodeURIComponent(encodedPrName);
        const part_title = decodeURIComponent(encodedPartTitle);

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

        // Récupère la partie
        const part = await prisma.part.findUnique({
            where: {
                part_title_parent_pr: {
                    part_title,
                    parent_pr: project.pr_id,
                },
            },
        });

        if (!part) {
            return notFoundResponse("Partie non trouvée");
        }

        return successResponse("Partie récupérée avec succès", { part });
    } catch (error) {
        console.error("Erreur lors de la récupération de la partie:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la récupération de la partie",
            error instanceof Error ? error.message : undefined
        );
    }
}

/**
 * Handler PATCH pour modifier une partie
 * @param request - Requête Next.js
 * @param context - Contexte avec les paramètres de route
 * @returns Réponse JSON avec la partie modifiée
 */
export async function PATCH(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Utilisateur non authentifié", undefined, 401);
        }

        const { pr_name: encodedPrName, part_title: encodedPartTitle } =
            await context.params;
        const pr_name = decodeURIComponent(encodedPrName);
        const currentTitle = decodeURIComponent(encodedPartTitle);

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

        const existingPart = await prisma.part.findUnique({
            where: {
                part_title_parent_pr: {
                    part_title: currentTitle,
                    parent_pr: project.pr_id,
                },
            },
        });

        if (!existingPart) {
            return notFoundResponse("Partie non trouvée");
        }

        const body = await request.json();
        const validatedData = updatePartSchema.parse(body);

        // Vérifie si le nouveau titre existe déjà (si changement de titre)
        if (
            validatedData.part_title &&
            validatedData.part_title !== currentTitle
        ) {
            const duplicateTitle = await prisma.part.findUnique({
                where: {
                    part_title_parent_pr: {
                        part_title: validatedData.part_title,
                        parent_pr: project.pr_id,
                    },
                },
            });

            if (duplicateTitle) {
                return errorResponse(
                    "Une partie avec ce titre existe déjà",
                    undefined,
                    409
                );
            }
        }

        // Vérifie si le nouveau numéro existe déjà (si changement de numéro)
        if (
            validatedData.part_number &&
            validatedData.part_number !== existingPart.part_number
        ) {
            const duplicateNumber = await prisma.part.findUnique({
                where: {
                    part_number_parent_pr: {
                        part_number: validatedData.part_number,
                        parent_pr: project.pr_id,
                    },
                },
            });

            // CORRECTION: Si le numéro existe DÉJÀ, c'est une erreur (logique inversée corrigée)
            if (duplicateNumber) {
                return errorResponse(
                    "Le numéro de partie " + validatedData.part_number +
                    " est déjà utilisé dans ce projet",
                    undefined,
                    409
                );
            }
        }

        //Mise à zéro du numéro de la partie pour éviter tout conflit
        const partNumberToZero = await prisma.part.update({
            where: {
                part_id: existingPart.part_id,
            },
            data: {
                ...(validatedData.part_number && {
                    part_number: 0,
                }),
            },
        });

        //Décalage de numéros des autres parties
        await renumberPartsAfterUpdate(existingPart.parent_pr, existingPart.part_number,
            validatedData.part_number ? validatedData.part_number : existingPart.part_number,
            existingPart.part_id);

        // Mise à jour de la partie
        const updatedPart = await prisma.part.update({
            where: {
                part_id: existingPart.part_id,
            },
            data: {
                ...(validatedData.part_title && {
                    part_title: validatedData.part_title,
                }),
                ...(validatedData.part_intro !== undefined && {
                    part_intro: validatedData.part_intro,
                }),
                ...(validatedData.part_number && {
                    part_number: validatedData.part_number,
                }),
            },
        });

        // 📡 Broadcast temps réel
        await realtimeService.broadcastStructureChange(
            pr_name,
            'STRUCTURE_CHANGED',
            {
                type: 'part',
                action: 'updated',
                partId: updatedPart.part_id
            }
        );

        return successResponse("Partie modifiée avec succès", {
            part: updatedPart,
        });
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

        console.error("Erreur lors de la modification de la partie:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la modification de la partie",
            error instanceof Error ? error.message : undefined
        );
    }
}

/**
 * Handler DELETE pour supprimer une partie
 * @param request - Requête Next.js
 * @param context - Contexte avec les paramètres de route
 * @returns Réponse JSON de confirmation
 */
export async function DELETE(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Utilisateur non authentifié", undefined, 401);
        }

        const { pr_name: encodedPrName, part_title: encodedPartTitle } =
            await context.params;
        const pr_name = decodeURIComponent(encodedPrName);
        const part_title = decodeURIComponent(encodedPartTitle);

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

        const existingPart = await prisma.part.findUnique({
            where: {
                part_title_parent_pr: {
                    part_title,
                    parent_pr: project.pr_id,
                },
            },
        });

        if (!existingPart) {
            return notFoundResponse("Partie non trouvée");
        }

        const deletedNumber = existingPart.part_number;

        // Suppression de la partie
        await prisma.part.delete({
            where: {
                part_id: existingPart.part_id,
            },
        });

        // Renumérotation des parties restantes
        await renumberPartsAfterDelete(project.pr_id, deletedNumber);

        // 📡 Broadcast temps réel
        await realtimeService.broadcastStructureChange(
            pr_name,
            'STRUCTURE_CHANGED',
            {
                type: 'part',
                action: 'deleted',
                partId: existingPart.part_id
            }
        );

        return successResponse("Partie supprimée avec succès");
    } catch (error) {
        console.error("Erreur lors de la suppression de la partie:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la suppression de la partie",
            error instanceof Error ? error.message : undefined
        );
    }
}