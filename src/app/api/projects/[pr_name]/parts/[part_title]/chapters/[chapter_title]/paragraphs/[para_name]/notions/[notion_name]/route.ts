/**
 * @fileoverview Routes API pour une notion spécifique
 * Gère la récupération, modification et suppression d'une notion par son nom
 *
 * @swagger
 * /api/projects/{pr_name}/parts/{part_title}/chapters/{chapter_title}/paragraphs/{para_name}/notions/{notion_name}:
 *   get:
 *     tags:
 *       - Notions
 *     summary: Récupérer une notion spécifique
 *     description: Récupère une notion par son nom
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
 *       - in: path
 *         name: notion_name
 *         required: true
 *         schema:
 *           type: string
 *         description: Nom de la notion
 *     responses:
 *       200:
 *         description: Notion récupérée avec succès
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
 *                   example: Notion récupérée avec succès
 *                 data:
 *                   type: object
 *                   properties:
 *                     notion:
 *                       $ref: '#/components/schemas/Notion'
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Notion non trouvée
 *       500:
 *         description: Erreur serveur
 *   patch:
 *     tags:
 *       - Notions
 *     summary: Modifier une notion
 *     description: Met à jour le nom ou le contenu d'une notion
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
 *       - in: path
 *         name: notion_name
 *         required: true
 *         schema:
 *           type: string
 *         description: Nom actuel de la notion
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notion_name:
 *                 type: string
 *                 example: Concept avancé
 *               notion_number:
 *                 type: integer
 *                 minimum: 1
 *                 example: 1
 *               notion_content:
 *                 type: string
 *                 example: Contenu révisé et enrichi de la notion...
 *     responses:
 *       200:
 *         description: Notion modifiée avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Notion non trouvée
 *       409:
 *         description: Conflit (nom déjà utilisé)
 *       422:
 *         description: Erreur de validation
 *       500:
 *         description: Erreur serveur
 *   delete:
 *     tags:
 *       - Notions
 *     summary: Supprimer une notion
 *     description: Supprime une notion définitivement
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
 *       - in: path
 *         name: notion_name
 *         required: true
 *         schema:
 *           type: string
 *         description: Nom de la notion à supprimer
 *     responses:
 *       200:
 *         description: Notion supprimée avec succès
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Notion non trouvée
 *       500:
 *         description: Erreur serveur
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { updateNotionSchema } from "@/utils/validation";
import {
    successResponse,
    errorResponse,
    notFoundResponse,
    validationErrorResponse,
    serverErrorResponse,
} from "@/utils/api-response";
import { ZodError } from "zod";
import { renumberNotionsAfterDelete, renumberNotionsAfterUpdate } from "@/utils/granule-helpers";

type RouteParams = {
    params: Promise<{
        pr_name: string;
        part_title: string;
        chapter_title: string;
        para_name: string;
        notion_name: string;
    }>;
};

/**
 * Handler GET pour récupérer une notion spécifique
 * @param request - Requête Next.js
 * @param context - Contexte avec les paramètres de route
 * @returns Réponse JSON avec la notion
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
            notion_name: encodedNotionName,
        } = await context.params;

        const pr_name = decodeURIComponent(encodedPrName);
        const part_title = decodeURIComponent(encodedPartTitle);
        const chapter_title = decodeURIComponent(encodedChapterTitle);
        const para_name = decodeURIComponent(encodedParaName);
        const notion_name = decodeURIComponent(encodedNotionName);

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

        // Vérifie que le paragraphe existe
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

        // Récupère la notion
        const notion = await prisma.notion.findUnique({
            where: {
                parent_para_notion_name: {
                    notion_name,
                    parent_para: paragraph.para_id,
                },
            },
        });

        if (!notion) {
            return notFoundResponse("Notion non trouvée");
        }

        return successResponse("Notion récupérée avec succès", { notion });
    } catch (error) {
        console.error("Erreur lors de la récupération de la notion:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la récupération de la notion",
            error instanceof Error ? error.message : undefined
        );
    }
}

/**
 * Handler PATCH pour modifier une notion
 * @param request - Requête Next.js
 * @param context - Contexte avec les paramètres de route
 * @returns Réponse JSON avec la notion modifiée
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
            notion_name: encodedNotionName,
        } = await context.params;

        const pr_name = decodeURIComponent(encodedPrName);
        const part_title = decodeURIComponent(encodedPartTitle);
        const chapter_title = decodeURIComponent(encodedChapterTitle);
        const para_name = decodeURIComponent(encodedParaName);
        const currentName = decodeURIComponent(encodedNotionName);

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

        const existingNotion = await prisma.notion.findUnique({
            where: {
                parent_para_notion_name: {
                    notion_name: currentName,
                    parent_para: paragraph.para_id,
                },
            },
        });

        if (!existingNotion) {
            return notFoundResponse("Notion non trouvée");
        }

        const body = await request.json();
        const validatedData = updateNotionSchema.parse(body);

        // Vérifie si le nouveau nom existe déjà (si changement de nom)
        if (
            validatedData.notion_name &&
            validatedData.notion_name !== currentName
        ) {
            const duplicateName = await prisma.notion.findUnique({
                where: {
                    parent_para_notion_name: {
                        notion_name: validatedData.notion_name,
                        parent_para: paragraph.para_id,
                    },
                },
            });

            if (duplicateName) {
                return errorResponse(
                    "Une notion avec ce nom existe déjà",
                    undefined,
                    409
                );
            }
        }

        // Vérifie si le numéro nom existe déjà (si changement de numéro)
        if (
            validatedData.notion_number &&
            validatedData.notion_number !== existingNotion.notion_number
        ) {
            const duplicateNumber = await prisma.notion.findUnique({
                where: {
                    parent_para_notion_number: {
                        notion_number: validatedData.notion_number,
                        parent_para: paragraph.para_id,
                    },
                },
            });

            if (!duplicateNumber) {
                return errorResponse(
                    "Le numéro est illogique car votre chapitre comporte moins de "
                    + validatedData.notion_number + " notions",
                    undefined,
                    409
                );
            }
        }

        //Mise à 0 du numéro de la notion
        const notionNumberToZer = await prisma.notion.update({
            where: {
                notion_id: existingNotion.notion_id,
            },
            data: {
                ...(validatedData.notion_number && {
                    notion_number: 0,
                }),
            },
        });

        await renumberNotionsAfterUpdate(existingNotion.parent_para,
            existingNotion.notion_number,
            validatedData.notion_number ? validatedData.notion_number : existingNotion.notion_number,
            existingNotion.notion_id);

        // Mise à jour de la notion
        const updatedNotion = await prisma.notion.update({
            where: {
                notion_id: existingNotion.notion_id,
            },
            data: {
                ...(validatedData.notion_name && {
                    notion_name: validatedData.notion_name,
                }),
                ...(validatedData.notion_number && {
                    notion_number: validatedData.notion_number,
                }),
                ...(validatedData.notion_content && {
                    notion_content: validatedData.notion_content,
                }),
            },
        });

        /* Renumérotation si le numéro a changé
        if (
            validatedData.notion_number &&
            validatedData.notion_number !== existingNotion.notion_number
        ) {
            await renumberNotionsAfterUpdate(
                paragraph.para_id,
                existingNotion.notion_number || 0,
                validatedData.notion_number,
                existingNotion.notion_id
            );
        }
         */

        return successResponse("Notion modifiée avec succès", {
            notion: updatedNotion,
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

        console.error("Erreur lors de la modification de la notion:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la modification de la notion",
            error instanceof Error ? error.message : undefined
        );
    }
}

/**
 * Handler DELETE pour supprimer une notion
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
            notion_name: encodedNotionName,
        } = await context.params;

        const pr_name = decodeURIComponent(encodedPrName);
        const part_title = decodeURIComponent(encodedPartTitle);
        const chapter_title = decodeURIComponent(encodedChapterTitle);
        const para_name = decodeURIComponent(encodedParaName);
        const notion_name = decodeURIComponent(encodedNotionName);

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

        // Vérifie que le paragraphe existe
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

        // Vérifie que la notion existe
        const existingNotion = await prisma.notion.findUnique({
            where: {
                parent_para_notion_name: {
                    notion_name,
                    parent_para: paragraph.para_id,
                },
            },
        });

        if (!existingNotion) {
            return notFoundResponse("Notion non trouvée");
        }

        // Suppression de la notion
        await prisma.notion.delete({
            where: {
                notion_id: existingNotion.notion_id,
            },
        });

        // Renumérotation si nécessaire
        if (existingNotion.notion_number !== null) {
            await renumberNotionsAfterDelete(
                paragraph.para_id,
                existingNotion.notion_number
            );
        }

        return successResponse("Notion supprimée avec succès");

    } catch (error) {
        console.error("Erreur lors de la suppression de la notion :", error);

        return serverErrorResponse(
            "Une erreur est survenue lors de la suppression de la notion",
            error instanceof Error ? error.message : undefined
        );
    }

}
