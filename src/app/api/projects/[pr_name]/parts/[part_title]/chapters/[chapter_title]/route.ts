/**
 * @fileoverview Routes API pour un chapitre spécifique
 * Gère la récupération, modification et suppression d'un chapitre par son titre
 *
 * @swagger
 * /api/projects/{pr_name}/parts/{part_title}/chapters/{chapter_title}:
 *   get:
 *     tags:
 *       - Chapters
 *     summary: Récupérer un chapitre spécifique
 *     description: Récupère un chapitre par son titre
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
 *       - in: path
 *         name: chapter_title
 *         required: true
 *         schema:
 *           type: string
 *         description: Titre du chapitre
 *     responses:
 *       200:
 *         description: Chapitre récupéré avec succès
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
 *                   example: Chapitre récupéré avec succès
 *                 data:
 *                   type: object
 *                   properties:
 *                     chapter:
 *                       $ref: '#/components/schemas/Chapter'
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Chapitre non trouvé
 *       500:
 *         description: Erreur serveur
 *   patch:
 *     tags:
 *       - Chapters
 *     summary: Modifier un chapitre
 *     description: Met à jour le titre ou le numéro d'un chapitre
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
 *       - in: path
 *         name: chapter_title
 *         required: true
 *         schema:
 *           type: string
 *         description: Titre actuel du chapitre
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               chapter_title:
 *                 type: string
 *                 example: Contexte Révisé
 *               chapter_number:
 *                 type: integer
 *                 example: 2
 *     responses:
 *       200:
 *         description: Chapitre modifié avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Chapitre non trouvé
 *       409:
 *         description: Conflit (titre ou numéro déjà utilisé)
 *       422:
 *         description: Erreur de validation
 *       500:
 *         description: Erreur serveur
 *   delete:
 *     tags:
 *       - Chapters
 *     summary: Supprimer un chapitre
 *     description: Supprime un chapitre et renuméroie automatiquement les autres
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
 *       - in: path
 *         name: chapter_title
 *         required: true
 *         schema:
 *           type: string
 *         description: Titre du chapitre à supprimer
 *     responses:
 *       200:
 *         description: Chapitre supprimé avec succès
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Chapitre non trouvé
 *       500:
 *         description: Erreur serveur
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { updateChapterSchema } from "@/utils/validation";
import {
    renumberChaptersAfterDelete,
    renumberChaptersAfterUpdate,
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
    params: Promise<{
        pr_name: string;
        part_title: string;
        chapter_title: string;
    }>;
};

/**
 * Handler GET pour récupérer un chapitre spécifique
 * @param request - Requête Next.js
 * @param context - Contexte avec les paramètres de route
 * @returns Réponse JSON avec le chapitre
 */
export async function GET(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Utilisateur non authentifié", undefined, 401);
        }

        const {
            pr_name: encodedPrName,
            part_title: encodedPartTitle,
            chapter_title: encodedChapterTitle,
        } = await context.params;

        const pr_name = decodeURIComponent(encodedPrName);
        const part_title = decodeURIComponent(encodedPartTitle);
        const chapter_title = decodeURIComponent(encodedChapterTitle);

        // Vérifie que le projet existe
        const project = await prisma.project.findUnique({
            where: {
                pr_name_owner_id: {
                    pr_name,
                    owner_id: userId,
                },
            },
        });

        if (!project) {
            return notFoundResponse("Projet non trouvé");
        }

        // Vérifie que la partie existe
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

        // Récupère le chapitre
        const chapter = await prisma.chapter.findUnique({
            where: {
                parent_part_chapter_title: {
                    chapter_title,
                    parent_part: part.part_id,
                },
            },
        });

        if (!chapter) {
            return notFoundResponse("Chapitre non trouvé");
        }

        return successResponse("Chapitre récupéré avec succès", { chapter });
    } catch (error) {
        console.error("Erreur lors de la récupération du chapitre:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la récupération du chapitre",
            error instanceof Error ? error.message : undefined
        );
    }
}

/**
 * Handler PATCH pour modifier un chapitre
 * @param request - Requête Next.js
 * @param context - Contexte avec les paramètres de route
 * @returns Réponse JSON avec le chapitre modifié
 */
export async function PATCH(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Utilisateur non authentifié", undefined, 401);
        }

        const {
            pr_name: encodedPrName,
            part_title: encodedPartTitle,
            chapter_title: encodedChapterTitle,
        } = await context.params;

        const pr_name = decodeURIComponent(encodedPrName);
        const part_title = decodeURIComponent(encodedPartTitle);
        const currentTitle = decodeURIComponent(encodedChapterTitle);

        const project = await prisma.project.findUnique({
            where: {
                pr_name_owner_id: {
                    pr_name,
                    owner_id: userId,
                },
            },
        });

        if (!project) {
            return notFoundResponse("Projet non trouvé");
        }

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

        const existingChapter = await prisma.chapter.findUnique({
            where: {
                parent_part_chapter_title: {
                    chapter_title: currentTitle,
                    parent_part: part.part_id,
                },
            },
        });

        if (!existingChapter) {
            return notFoundResponse("Chapitre non trouvé");
        }

        const body = await request.json();
        const validatedData = updateChapterSchema.parse(body);

        // Vérifie si le nouveau titre existe déjà (si changement de titre)
        if (
            validatedData.chapter_title &&
            validatedData.chapter_title !== currentTitle
        ) {
            const duplicateTitle = await prisma.chapter.findUnique({
                where: {
                    parent_part_chapter_title: {
                        chapter_title: validatedData.chapter_title,
                        parent_part: part.part_id,
                    },
                },
            });

            if (duplicateTitle) {
                return errorResponse(
                    "Un chapitre avec ce titre existe déjà",
                    undefined,
                    409
                );
            }
        }

        // Vérifie si le nouveau numéro existe déjà (si changement de numéro)
        if (
            validatedData.chapter_number &&
            validatedData.chapter_number !== existingChapter.chapter_number
        ) {
            const duplicateNumber = await prisma.chapter.findUnique({
                where: {
                    parent_part_chapter_number: {
                        chapter_number: validatedData.chapter_number,
                        parent_part: part.part_id,
                    },
                },
            });

            if (!duplicateNumber) {
                // Réponse 409
                return errorResponse(
                    "Le nouveau numéro est illogique car votre partie a moins de "
                    +validatedData.chapter_number + " chapitres",
                    undefined,
                    409
                );
            }
        }

        // Mise à zéro du numéro du chapitre afin d'éviter tout conflit
        const chapterNumberToZero = await prisma.chapter.update({
            where: {
                chapter_id: existingChapter.chapter_id,
            },
            data: {
                ...(validatedData.chapter_number && {
                    chapter_number: 0,
                }),
            },
        });

        await renumberChaptersAfterUpdate(existingChapter.parent_part, existingChapter.chapter_number,
            validatedData.chapter_number? validatedData.chapter_number: existingChapter.chapter_number,
            existingChapter.chapter_id);

        // Mise à jour du chapitre
        const updatedChapter = await prisma.chapter.update({
            where: {
                chapter_id: existingChapter.chapter_id,
            },
            data: {
                ...(validatedData.chapter_title && {
                    chapter_title: validatedData.chapter_title,
                }),
                ...(validatedData.chapter_number && {
                    chapter_number: validatedData.chapter_number,
                }),
            },
        });

        return successResponse("Chapitre modifié avec succès", {
            chapter: updatedChapter,
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

        console.error("Erreur lors de la modification du chapitre:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la modification du chapitre",
            error instanceof Error ? error.message : undefined
        );
    }
}

/**
 * Handler DELETE pour supprimer un chapitre
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

        const {
            pr_name: encodedPrName,
            part_title: encodedPartTitle,
            chapter_title: encodedChapterTitle,
        } = await context.params;

        const pr_name = decodeURIComponent(encodedPrName);
        const part_title = decodeURIComponent(encodedPartTitle);
        const chapter_title = decodeURIComponent(encodedChapterTitle);

        const project = await prisma.project.findUnique({
            where: {
                pr_name_owner_id: {
                    pr_name,
                    owner_id: userId,
                },
            },
        });

        if (!project) {
            return notFoundResponse("Projet non trouvé");
        }

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

        const existingChapter = await prisma.chapter.findUnique({
            where: {
                parent_part_chapter_title: {
                    chapter_title,
                    parent_part: part.part_id,
                },
            },
        });

        if (!existingChapter) {
            return notFoundResponse("Chapitre non trouvé");
        }

        const deletedNumber = existingChapter.chapter_number;

        // Suppression du chapitre
        await prisma.chapter.delete({
            where: {
                chapter_id: existingChapter.chapter_id,
            },
        });

        // Renumérotation des chapitres restants
        await renumberChaptersAfterDelete(part.part_id, deletedNumber);

        return successResponse("Chapitre supprimé avec succès");
    } catch (error) {
        console.error("Erreur lors de la suppression du chapitre:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la suppression du chapitre",
            error instanceof Error ? error.message : undefined
        );
    }
}