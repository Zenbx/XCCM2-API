/**
 * @fileoverview Routes API pour la gestion des chapitres (Chapters)
 * Gère la création et la récupération de tous les chapitres d'une partie
 *
 * @swagger
 * /api/projects/{pr_name}/parts/{part_title}/chapters:
 *   post:
 *     tags:
 *       - Chapters
 *     summary: Créer un nouveau chapitre
 *     description: Crée un nouveau chapitre dans une partie avec renumérotation automatique
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chapter_title
 *               - chapter_number
 *             properties:
 *               chapter_title:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 200
 *                 example: Contexte historique
 *               chapter_number:
 *                 type: integer
 *                 minimum: 1
 *                 example: 1
 *     responses:
 *       201:
 *         description: Chapitre créé avec succès
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
 *                   example: Chapitre créé avec succès
 *                 data:
 *                   type: object
 *                   properties:
 *                     chapter:
 *                       $ref: '#/components/schemas/Chapter'
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Projet ou partie non trouvé
 *       409:
 *         description: Un chapitre avec ce titre existe déjà
 *       422:
 *         description: Erreur de validation
 *       500:
 *         description: Erreur serveur
 *   get:
 *     tags:
 *       - Chapters
 *     summary: Récupérer tous les chapitres d'une partie
 *     description: Retourne la liste de tous les chapitres d'une partie, triés par numéro
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
 *         description: Chapitres récupérés avec succès
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
 *                   example: Chapitres récupérés avec succès
 *                 data:
 *                   type: object
 *                   properties:
 *                     chapters:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Chapter'
 *                     count:
 *                       type: integer
 *                       example: 5
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Projet ou partie non trouvé
 *       500:
 *         description: Erreur serveur
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { createChapterSchema } from "@/utils/validation";
import { realtimeService } from "@/services/realtime-service";
//import { renumberChaptersAfterInsert } from "@/utils/granule-helpers";
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
 * Handler POST pour créer un nouveau chapitre
 * @param request - Requête Next.js
 * @param context - Contexte avec les paramètres de route
 * @returns Réponse JSON avec le chapitre créé
 */
export async function POST(request: NextRequest, context: RouteParams) {
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

        const body = await request.json();
        const validatedData = createChapterSchema.parse(body);

        // Vérifie si un chapitre avec ce titre existe déjà dans cette partie
        const existingChapter = await prisma.chapter.findUnique({
            where: {
                parent_part_chapter_title: {
                    chapter_title: validatedData.chapter_title,
                    parent_part: part.part_id,
                },
            },
        });

        if (existingChapter) {
            return errorResponse(
                "Un chapitre avec ce titre existe déjà dans cette partie",
                undefined,
                409
            );
        }

        // Vérifie si le numéro est déjà pris
        const existingNumber = await prisma.chapter.findUnique({
            where: {
                parent_part_chapter_number: {
                    chapter_number: validatedData.chapter_number,
                    parent_part: part.part_id,
                },
            },
        });

        // Si le numéro existe, on retourne une réponse 409
        if (existingNumber) {
            return errorResponse(
                "Un chapitre avec ce numéro existe déjà dans cette partie",
                undefined,
                409
            );
        }

        //Vérifier si le numéro est logique. Il doit etre le succeseur du nombre de chapter

        const countChapters = await prisma.chapter.count({
            where: {
                parent_part: part.part_id
            }
        });

        if (validatedData.chapter_number !== countChapters + 1) {
            return errorResponse(
                "Votre partie ne compte que " + countChapters
                + " chapitres du cou votre numéro de chapitres est illogique",
                undefined,
                409
            );
        }

        // Création du chapitre
        const chapter = await prisma.chapter.create({
            data: {
                chapter_title: validatedData.chapter_title,
                chapter_number: validatedData.chapter_number,
                parent_part: part.part_id,
                owner_id: userId,
            },
        });

        // 📡 Broadcast temps réel
        await realtimeService.broadcastStructureChange(
            pr_name,
            'STRUCTURE_CHANGED',
            {
                type: 'chapter',
                action: 'created',
                chapterId: chapter.chapter_id,
                partTitle: part_title
            }
        );

        return successResponse("Chapitre créé avec succès", { chapter }, 201);
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

        console.error("Erreur lors de la création du chapitre:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la création du chapitre",
            error instanceof Error ? error.message : undefined
        );
    }
}

/**
 * Handler GET pour récupérer tous les chapitres d'une partie
 * @param request - Requête Next.js
 * @param context - Contexte avec les paramètres de route
 * @returns Réponse JSON avec la liste des chapitres
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

        // Récupère tous les chapitres de la partie, triés par numéro
        const chapters = await prisma.chapter.findMany({
            where: {
                parent_part: part.part_id,
            },
            orderBy: {
                chapter_number: "asc",
            },
        });

        return successResponse("Chapitres récupérés avec succès", {
            chapters,
            count: chapters.length,
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des chapitres:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la récupération des chapitres",
            error instanceof Error ? error.message : undefined
        );
    }
}