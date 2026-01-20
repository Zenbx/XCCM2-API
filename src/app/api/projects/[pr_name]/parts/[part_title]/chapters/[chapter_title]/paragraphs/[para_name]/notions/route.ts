/**
 * @fileoverview Routes API pour la gestion des notions (Notions)
 * Gère la création et la récupération de toutes les notions d'un paragraphe
 *
 * @swagger
 * /api/projects/{pr_name}/parts/{part_title}/chapters/{chapter_title}/paragraphs/{para_name}/notions:
 *   post:
 *     tags:
 *       - Notions
 *     summary: Créer une nouvelle notion
 *     description: Crée une nouvelle notion dans un paragraphe
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - notion_name
 *               - notion_content
 *             properties:
 *               notion_name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 200
 *                 example: Concept de base
 *               notion_number:
 *                 type: integer
 *                 minimum: 1
 *                 example: 1
 *               notion_content:
 *                 type: string
 *                 example: Le contenu détaillé de la notion expliquant le concept...
 *     responses:
 *       201:
 *         description: Notion créée avec succès
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
 *                   example: Notion créée avec succès
 *                 data:
 *                   type: object
 *                   properties:
 *                     notion:
 *                       $ref: '#/components/schemas/Notion'
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Projet, partie, chapitre ou paragraphe non trouvé
 *       409:
 *         description: Une notion avec ce nom existe déjà
 *       422:
 *         description: Erreur de validation
 *       500:
 *         description: Erreur serveur
 *   get:
 *     tags:
 *       - Notions
 *     summary: Récupérer toutes les notions d'un paragraphe
 *     description: Retourne la liste de toutes les notions d'un paragraphe
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
 *         description: Notions récupérées avec succès
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
 *                   example: Notions récupérées avec succès
 *                 data:
 *                   type: object
 *                   properties:
 *                     notions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Notion'
 *                     count:
 *                       type: integer
 *                       example: 12
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Projet, partie, chapitre ou paragraphe non trouvé
 *       500:
 *         description: Erreur serveur
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { createNotionSchema } from "@/utils/validation";
import {
    successResponse,
    errorResponse,
    notFoundResponse,
    validationErrorResponse,
    serverErrorResponse,
} from "@/utils/api-response";
import { ZodError } from "zod";
import { realtimeService } from "@/services/realtime-service";

type RouteParams = {
    params: Promise<{
        pr_name: string;
        part_title: string;
        chapter_title: string;
        para_name: string;
    }>;
};

/**
 * Handler POST pour créer une nouvelle notion
 * @param request - Requête Next.js
 * @param context - Contexte avec les paramètres de route
 * @returns Réponse JSON avec la notion créée
 */
export async function POST(request: NextRequest, context: RouteParams) {
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

        const body = await request.json();
        const validatedData = createNotionSchema.parse(body);

        // Vérifie si une notion avec ce nom existe déjà dans ce paragraph
        const existingNotion = await prisma.notion.findUnique({
            where: {
                parent_para_notion_name: {
                    notion_name: validatedData.notion_name,
                    parent_para: paragraph.para_id,
                },
            },
        });

        if (existingNotion) {
            return errorResponse(
                "Une notion avec ce nom existe déjà dans ce paragraphe",
                undefined,
                409
            );
        }

        // Vérifie si le numéro est déjà pris
        const existingNumber = await prisma.notion.findUnique({
            where: {
                parent_para_notion_number: {
                    notion_number: validatedData.notion_number,
                    parent_para: paragraph.para_id,
                },
            },
        });

        // Si le numéro existe, on retourne une réponse 409
        if (existingNumber) {
            return errorResponse(
                "Une notion avec ce numéro existe déjà dans ce paragraph",
                undefined,
                409
            );
        }

        // Création de la notion
        const notion = await prisma.notion.create({
            data: {
                notion_name: validatedData.notion_name,
                notion_number: validatedData.notion_number,
                notion_content: validatedData.notion_content,
                parent_para: paragraph.para_id,
                owner_id: userId,
            },
        });

        // 📡 Broadcast temps réel
        await realtimeService.broadcastStructureChange(
            pr_name,
            'STRUCTURE_CHANGED',
            {
                type: 'notion',
                action: 'created',
                notionId: notion.notion_id,
                paraName: para_name
            }
        );

        return successResponse("Notion créée avec succès", { notion }, 201);
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

        console.error("Erreur lors de la création de la notion:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la création de la notion",
            error instanceof Error ? error.message : undefined
        );
    }
}

/**
 * Handler GET pour récupérer toutes les notions d'un paragraphe
 * @param request - Requête Next.js
 * @param context - Contexte avec les paramètres de route
 * @returns Réponse JSON avec la liste des notions
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

        // On peut maintenant chercher le paragraphe directement car on a pr_id et les noms
        // Pour être ultra-safe, on traverse quand même mais on pourrait simplifier.
        // On va garder la traversée pour la cohérence des 404, mais on ajoute owner_id partout.

        const part = await prisma.part.findUnique({
            where: {
                part_title_parent_pr: { part_title, parent_pr: project.pr_id },
            },
        });

        if (!part) return notFoundResponse("Partie non trouvée");

        const chapter = await prisma.chapter.findUnique({
            where: {
                parent_part_chapter_title: { chapter_title, parent_part: part.part_id },
            },
        });

        if (!chapter) return notFoundResponse("Chapitre non trouvé");

        const paragraph = await prisma.paragraph.findUnique({
            where: {
                parent_chapter_para_name: { para_name, parent_chapter: chapter.chapter_id },
            },
        });

        if (!paragraph) return notFoundResponse("Paragraphe non trouvé");

        // Récupère toutes les notions du paragraphe
        const notions = await prisma.notion.findMany({
            where: {
                parent_para: paragraph.para_id,
            },
            orderBy: {
                notion_number: "asc",
            },
        });

        return successResponse("Notions récupérées avec succès", {
            notions,
            count: notions.length,
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des notions:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la récupération des notions",
            error instanceof Error ? error.message : undefined
        );
    }
}