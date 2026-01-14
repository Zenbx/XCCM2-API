/**
 * @fileoverview Routes API pour la gestion des paragraphes (Paragraphs)
 * Gère la création et la récupération de tous les paragraphes d'un chapitre
 *
 * @swagger
 * /api/projects/{pr_name}/parts/{part_title}/chapters/{chapter_title}/paragraphs:
 *   post:
 *     tags:
 *       - Paragraphs
 *     summary: Créer un nouveau paragraphe
 *     description: Crée un nouveau paragraphe dans un chapitre
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - para_name
 *               - para_number
 *             properties:
 *               para_name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 200
 *                 example: Définitions
 *               para_number:
 *                 type: integer
 *                 minimum: 1
 *                 example: 1
 *     responses:
 *       201:
 *         description: Paragraphe créé avec succès
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
 *                   example: Paragraphe créé avec succès
 *                 data:
 *                   type: object
 *                   properties:
 *                     paragraph:
 *                       $ref: '#/components/schemas/Paragraph'
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Projet, partie ou chapitre non trouvé
 *       409:
 *         description: Un paragraphe avec ce nom ou numéro existe déjà
 *       422:
 *         description: Erreur de validation
 *       500:
 *         description: Erreur serveur
 *   get:
 *     tags:
 *       - Paragraphs
 *     summary: Récupérer tous les paragraphes d'un chapitre
 *     description: Retourne la liste de tous les paragraphes d'un chapitre, triés par numéro
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
 *         description: Paragraphes récupérés avec succès
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
 *                   example: Paragraphes récupérés avec succès
 *                 data:
 *                   type: object
 *                   properties:
 *                     paragraphs:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Paragraph'
 *                     count:
 *                       type: integer
 *                       example: 8
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Projet, partie ou chapitre non trouvé
 *       500:
 *         description: Erreur serveur
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { createParagraphSchema } from "@/utils/validation";
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
 * Handler POST pour créer un nouveau paragraphe
 * @param request - Requête Next.js
 * @param context - Contexte avec les paramètres de route
 * @returns Réponse JSON avec le paragraphe créé
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

        const body = await request.json();
        const validatedData = createParagraphSchema.parse(body);

        // Vérifie si un paragraphe avec ce nom existe déjà dans ce chapitre
        const existingParaName = await prisma.paragraph.findUnique({
            where: {
                parent_chapter_para_name: {
                    para_name: validatedData.para_name,
                    parent_chapter: chapter.chapter_id,
                },
            },
        });

        if (existingParaName) {
            return errorResponse(
                "Un paragraphe avec ce nom existe déjà dans ce chapitre",
                undefined,
                409
            );
        }

        // Vérifie si un paragraphe avec ce numéro existe déjà
        const existingParaNumber = await prisma.paragraph.findUnique({
            where: {
                parent_chapter_para_number: {
                    para_number: validatedData.para_number,
                    parent_chapter: chapter.chapter_id,
                },
            },
        });

        if (existingParaNumber) {
            return errorResponse(
                "Un paragraphe avec ce numéro existe déjà dans ce chapitre",
                undefined,
                409
            );
        }

        // Création du paragraphe
        const paragraph = await prisma.paragraph.create({
            data: {
                para_name: validatedData.para_name,
                para_number: validatedData.para_number,
                parent_chapter: chapter.chapter_id,
                owner_id: userId,
            },
        });

        return successResponse("Paragraphe créé avec succès", { paragraph }, 201);
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

        console.error("Erreur lors de la création du paragraphe:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la création du paragraphe",
            error instanceof Error ? error.message : undefined
        );
    }
}

/**
 * Handler GET pour récupérer tous les paragraphes d'un chapitre
 * @param request - Requête Next.js
 * @param context - Contexte avec les paramètres de route
 * @returns Réponse JSON avec la liste des paragraphes
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


        // Récupère tous les paragraphes du chapitre, triés par numéro
        const paragraphs = await prisma.paragraph.findMany({
            where: {
                parent_chapter: chapter.chapter_id,
            },
            orderBy: {
                para_number: "asc",
            },
        });
        return successResponse("Paragraphes récupérés avec succès", {
            paragraphs,
            count: paragraphs.length,
        });

        /*return successResponse("Paragraphes récupérés avec succès", {
            paragraphs: sortedParagraphs,
            count: sortedParagraphs.length,
        });*/
    } catch (error) {
        console.error("Erreur lors de la récupération des paragraphes:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la récupération des paragraphes",
            error instanceof Error ? error.message : undefined
        );
    }
}