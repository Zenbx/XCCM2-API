/**
 * @fileoverview Route API pour reformuler le contenu d'une Notion
 * Endpoint : POST /api/projects/{pr_name}/parts/{part_title}/chapters/{chapter_title}/paragraphs/{para_name}/notions/{notion_name}/rephrase
 *
 * - Authentification : protégée par le middleware JWT (x-user-id requis)
 * - Rôle : appeler le service de chatbot pour reformuler notion_content
 * - Validation : Zod sur le body (style, mode de sauvegarde, etc.)
 *
 * L'implémentation est préparée pour utiliser `rephraseNotion` depuis `src/lib/chatbot.ts`.
 *
 * @swagger
 * /api/projects/{pr_name}/parts/{part_title}/chapters/{chapter_title}/paragraphs/{para_name}/notions/{notion_name}/rephrase:
 *   post:
 *     tags:
 *       - Notions
 *     summary: Reformuler une notion spécifique
 *     description: Reformuler le contenu d'une Notion via chatbot IA
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - style
 *             properties:
 *               style:
 *                 type: string
 *                 description: Style de reformulation (ex. simple, formal, french)
 *                 example: simple
 *               previewOnly:
 *                 type: boolean
 *                 description: Si true, ne sauvegarde pas en base (mode preview)
 *                 default: true
 *     responses:
 *       200:
 *         description: Notion reformulée avec succès
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
 *                   example: Notion reformulée avec succès
 *                 data:
 *                   type: object
 *                   properties:
 *                     original_content:
 *                       type: string
 *                       description: Contenu original de la notion
 *                     rephrased_content:
 *                       type: string
 *                       description: Contenu reformulé par le chatbot
 *                     preview_only:
 *                       type: boolean
 *                       description: Indique si la reformulation a été seulement prévisualisée
 *       401:
 *         description: Non autorisé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         description: Ressource non trouvée (projet/partie/chapitre/paragraphe/notion)
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
import {
    successResponse,
    errorResponse,
    notFoundResponse,
    serverErrorResponse,
    validationErrorResponse,
} from "@/utils/api-response";
import { z, ZodError } from "zod";
import { rephraseNotion } from "@/lib/chatbot";

/**
 * Type des paramètres de route (Next.js 15+ avec App Router)
 * On reprend le même pattern que la route Notion principale.
 */
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
 * Schéma Zod pour la requête de reformulation de Notion.
 *
 * Exemple de body :
 * {
 *   "style": "simple",
 *   "previewOnly": true
 * }
 */
const rephraseNotionSchema = z.object({
    style: z
        .string()
        .min(1, "Le style de reformulation est requis")
        .max(50, "Le style de reformulation est trop long"),
    previewOnly: z
        .boolean()
        .default(true)
        .describe(
            "Si true, ne sauvegarde pas le texte reformulé en base, ne fait que le retourner."
        ),
});

/**
 * Handler POST pour reformuler le contenu d'une Notion.
 *
 * Étapes principales :
 * 1. Vérifier l'authentification (x-user-id injecté par le middleware)
 * 2. Résoudre la hiérarchie projet → part → chapter → paragraph → notion
 * 3. Valider les options de reformulation (style, previewOnly) via Zod
 * 4. Appeler `rephraseNotion` (service Hugging Face)
 * 5. Retourner la reformulation (et éventuellement la sauvegarder plus tard)
 */
export async function POST(request: NextRequest, context: RouteParams) {
    try {
        // 1️⃣ Authentification
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Utilisateur non authentifié", undefined, 401);
        }

        // 2️⃣ Récupération et décodage des paramètres de route
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

        // 3️⃣ Vérification de la hiérarchie projet/part/chapter/paragraph/notion

        // Projet
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

        // Part
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

        // Chapter
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

        // Paragraph
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

        // Notion
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

        if (!notion.notion_content || !notion.notion_content.trim()) {
            return errorResponse(
                "La notion ne contient pas de contenu à reformuler",
                undefined,
                400
            );
        }

        // 4️⃣ Validation du body avec Zod
        const body = await request.json().catch(() => ({}));

        const validated = rephraseNotionSchema.parse(body);

        // 5️⃣ Appel du service de chatbot (Hugging Face)
        console.log(
            "[notion-rephrase] Reformulation demandée pour la notion:",
            notion.notion_id,
            "style=",
            validated.style
        );

        const rephrasedText = await rephraseNotion(notion.notion_content, {
            style: validated.style,
        });

        // 6️⃣ (Optionnel) Sauvegarde en base si previewOnly === false
        // Pour l'instant, on prépare la structure et on ne persiste pas
        // afin de garder ce handler non-destructif par défaut.

        /*
        let updatedNotion = notion;
        if (!validated.previewOnly) {
            updatedNotion = await prisma.notion.update({
                where: { notion_id: notion.notion_id },
                data: {
                    notion_content: rephrasedText,
                },
            });
        }
        */

        return successResponse("Notion reformulée avec succès", {
            original_content: notion.notion_content,
            rephrased_content: rephrasedText,
            preview_only: validated.previewOnly,
            // notion: updatedNotion, // à activer si on persiste la nouvelle version
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

        console.error(
            "Erreur lors de la reformulation de la notion :",
            error
        );

        return serverErrorResponse(
            "Une erreur est survenue lors de la reformulation de la notion",
            error instanceof Error ? error.message : undefined
        );
    }
}

