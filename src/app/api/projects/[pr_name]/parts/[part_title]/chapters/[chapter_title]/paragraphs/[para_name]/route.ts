/**
 * @fileoverview Routes API pour un paragraphe spécifique
 * Gère la récupération, modification et suppression d'un paragraphe par son nom
 *
 * @swagger
 * /api/projects/{pr_name}/parts/{part_title}/chapters/{chapter_title}/paragraphs/{para_name}:
 *   get:
 *     tags:
 *       - Paragraphs
 *     summary: Récupérer un paragraphe spécifique
 *     description: Récupère un paragraphe par son nom
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
 *       - in: path
 *         name: para_name
 *         required: true
 *         schema:
 *           type: string
 *         description: Nom du paragraphe
 *     responses:
 *       200:
 *         description: Paragraphe récupéré avec succès
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
 *                   example: Paragraphe récupéré avec succès
 *                 data:
 *                   type: object
 *                   properties:
 *                     paragraph:
 *                       $ref: '#/components/schemas/Paragraph'
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Paragraphe non trouvé
 *       500:
 *         description: Erreur serveur
 *   patch:
 *     tags:
 *       - Paragraphs
 *     summary: Modifier un paragraphe
 *     description: Met à jour le nom ou le numéro d'un paragraphe
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
 *       - in: path
 *         name: para_name
 *         required: true
 *         schema:
 *           type: string
 *         description: Nom actuel du paragraphe
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               para_name:
 *                 type: string
 *                 example: Nouvelles Définitions
 *               para_number:
 *                 type: integer
 *                 minimum: 1
 *                 example: 1
 *     responses:
 *       200:
 *         description: Paragraphe modifié avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Paragraphe non trouvé
 *       409:
 *         description: Conflit (nom ou numéro déjà utilisé)
 *       422:
 *         description: Erreur de validation
 *       500:
 *         description: Erreur serveur
 *   delete:
 *     tags:
 *       - Paragraphs
 *     summary: Supprimer un paragraphe
 *     description: Supprime un paragraphe définitivement
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
 *       - in: path
 *         name: para_name
 *         required: true
 *         schema:
 *           type: string
 *         description: Nom du paragraphe à supprimer
 *     responses:
 *       200:
 *         description: Paragraphe supprimé avec succès
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Paragraphe non trouvé
 *       500:
 *         description: Erreur serveur
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { updateParagraphSchema } from "@/utils/validation";
import { renumberParagraphsAfterDelete, renumberParagraphsAfterUpdate } from "@/utils/granule-helpers";
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
        para_name: string;
    }>;
};

/**
 * Handler GET pour récupérer un paragraphe spécifique
 * @param request - Requête Next.js
 * @param context - Contexte avec les paramètres de route
 * @returns Réponse JSON avec le paragraphe
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
            para_name: encodedParaName,
        } = await context.params;

        const pr_name = decodeURIComponent(encodedPrName);
        const part_title = decodeURIComponent(encodedPartTitle);
        const chapter_title = decodeURIComponent(encodedChapterTitle);
        const para_name = decodeURIComponent(encodedParaName);

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

        // Vérifie que le chapitre existe
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

        // Récupère le paragraphe
        const paragraph = await prisma.paragraph.findUnique({
            where: {
                parent_chapter_para_name: {
                    para_name,
                    parent_chapter: chapter.chapter_id,
                },
            },
        });

        if (!paragraph) {
            return notFoundResponse("Paragraphe non trouvé");
        }

        return successResponse("Paragraphe récupéré avec succès", { paragraph });
    } catch (error) {
        console.error("Erreur lors de la récupération du paragraphe:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la récupération du paragraphe",
            error instanceof Error ? error.message : undefined
        );
    }
}

/**
 * Handler PATCH pour modifier un paragraphe
 * @param request - Requête Next.js
 * @param context - Contexte avec les paramètres de route
 * @returns Réponse JSON avec le paragraphe modifié
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
            para_name: encodedParaName,
        } = await context.params;

        const pr_name = decodeURIComponent(encodedPrName);
        const part_title = decodeURIComponent(encodedPartTitle);
        const chapter_title = decodeURIComponent(encodedChapterTitle);
        const currentName = decodeURIComponent(encodedParaName);

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

        const existingParagraph = await prisma.paragraph.findUnique({
            where: {
                parent_chapter_para_name: {
                    para_name: currentName,
                    parent_chapter: chapter.chapter_id,
                },
            },
        });

        if (!existingParagraph) {
            return notFoundResponse("Paragraphe non trouvé");
        }

        const body = await request.json();
        const validatedData = updateParagraphSchema.parse(body);

        // Vérifie si le nouveau nom existe déjà (si changement de nom)
        if (validatedData.para_name && validatedData.para_name !== currentName) {
            const duplicateName = await prisma.paragraph.findUnique({
                where: {
                    parent_chapter_para_name: {
                        para_name: validatedData.para_name,
                        parent_chapter: chapter.chapter_id,
                    },
                },
            });

            if (duplicateName) {
                return errorResponse(
                    "Un paragraphe avec ce nom existe déjà",
                    undefined,
                    409
                );
            }
        }

        // Vérifie si le nouveau numéro existe déjà (si changement de numéro)
        if (
            validatedData.para_number &&
            validatedData.para_number !== existingParagraph.para_number
        ) {
            const duplicateNumber = await prisma.paragraph.findUnique({
                where: {
                    parent_chapter_para_number: {
                        para_number: validatedData.para_number,
                        parent_chapter: chapter.chapter_id,
                    },
                },
            });

            if (!duplicateNumber) {
                return errorResponse(
                    "Votre chapitre a moins de " + validatedData.para_number
                    + " paragraphes donc le nouveau numéro est illogique",
                    undefined,
                    409
                );
            }
        }

        //Mise à 0 du numéro du paragraph
        const paragraphNumberToZero = await prisma.paragraph.update({
            where: {
                para_id: existingParagraph.para_id,
            },
            data: {
                ...(validatedData.para_number && {
                    para_number: 0,
                }),
            },
        });

        await renumberParagraphsAfterUpdate(existingParagraph.parent_chapter,
            existingParagraph.para_number,
            validatedData.para_number ? validatedData.para_number : existingParagraph.para_number,
            existingParagraph.para_id);


        // Mise à jour du paragraphe
        const updatedParagraph = await prisma.paragraph.update({
            where: {
                para_id: existingParagraph.para_id,
            },
            data: {
                ...(validatedData.para_name && {
                    para_name: validatedData.para_name,
                }),
                ...(validatedData.para_number && {
                    para_number: validatedData.para_number,
                }),
            },
        });

        return successResponse("Paragraphe modifié avec succès", {
            paragraph: updatedParagraph,
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

        console.error("Erreur lors de la modification du paragraphe:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la modification du paragraphe",
            error instanceof Error ? error.message : undefined
        );
    }
}

/**
 * Handler DELETE pour supprimer un paragraphe
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
            para_name: encodedParaName,
        } = await context.params;

        const pr_name = decodeURIComponent(encodedPrName);
        const part_title = decodeURIComponent(encodedPartTitle);
        const chapter_title = decodeURIComponent(encodedChapterTitle);
        const para_name = decodeURIComponent(encodedParaName);

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

        const existingParagraph = await prisma.paragraph.findUnique({
            where: {
                parent_chapter_para_name: {
                    para_name,
                    parent_chapter: chapter.chapter_id,
                },
            },
        });

        if (!existingParagraph) {
            return notFoundResponse("Paragraphe non trouvé");
        }

        // Suppression du paragraphe
        await prisma.paragraph.delete({
            where: {
                para_id: existingParagraph.para_id,
            },
        });

        // Renumérotation des chapitres restants
        await renumberParagraphsAfterDelete(chapter.chapter_id, existingParagraph.para_number);

        return successResponse("Paragraphe supprimé avec succès");


    } catch (error) {
        console.error("Erreur lors de la suppression du paragraphe:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la suppression du paragraphe",
            error instanceof Error ? error.message : undefined
        );
    }
}