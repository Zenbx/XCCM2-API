/**
 * @fileoverview Route API pour la publication de documents
 * Génère le document, l'upload sur Supabase Storage et stocke l'URL dans la BD
 *
 */
/**
 * @openapi
 * /api/projects/{pr_name}/publish:
 *   post:
 *     tags:
 *       - Documents
 *     summary: Publier un projet (Snapshot)
 *     description: Génère un PDF ou DOCX à partir du projet et le publie dans la bibliothèque.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pr_name
 *         required: true
 *         schema: { type: string }
 *         description: Nom du projet à publier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [format]
 *             properties:
 *               format: { type: string, enum: [pdf, docx] }
 *               doc_name: { type: string, description: "Nom personnalisé du snapshot" }
 *               cover_image: { type: string, description: "URL de l'image de couverture" }
 *     responses:
 *       201:
 *         description: Document publié avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     document: { $ref: '#/components/schemas/Document' }
 *       409:
 *         description: Nom de document déjà utilisé
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export const maxDuration = 60;
import { getProjectForExport, publishDocument } from "@/lib/document-service";
import { cacheService } from "@/services/cache-service";
import {
    successResponse,
    errorResponse,
    notFoundResponse,
    validationErrorResponse,
} from "@/utils/api-response";
import type { DocumentFormat, ProjectForExport } from "@/types/document.types";
import { z } from "zod";

type RouteParams = {
    params: Promise<{ pr_name: string }>;
};

/**
 * Schéma de validation pour la publication
 */
const publishSchema = z.object({
    format: z.enum(["pdf", "docx"] as const),
});



/**
 * Estime le nombre de pages d'un document
 * (Estimation approximative basée sur le contenu)
 * @param project - Projet à analyser
 * @returns Nombre estimé de pages
 */
function estimatePages(project: ProjectForExport): number {
    let totalContent = 0;

    // Compte le contenu
    project.parts.forEach((part) => {
        totalContent += (part.part_title?.length || 0);
        totalContent += (part.part_intro?.length || 0);

        part.chapters.forEach((chapter) => {
            totalContent += (chapter.chapter_title?.length || 0);

            chapter.paragraphs.forEach((paragraph) => {
                totalContent += (paragraph.para_name?.length || 0);

                paragraph.notions.forEach((notion) => {
                    totalContent += (notion.notion_name?.length || 0);
                    totalContent += (notion.notion_content?.length || 0);
                });
            });
        });
    });

    // Estimation : ~2500 caractères par page
    const estimatedPages = Math.max(1, Math.ceil(totalContent / 2500));

    return estimatedPages;
}
/**
 * Handler POST pour publier un projet
 * @param request - Requête Next.js avec le format dans le body
 * @param context - Contexte avec les paramètres de route
 * @returns Réponse JSON avec les informations du document publié
 */
export async function POST(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Utilisateur non authentifié", undefined, 401);
        }

        const { pr_name: encodedName } = await context.params;
        const pr_name = decodeURIComponent(encodedName);

        console.log('🔍 DEBUG Publication:', { pr_name, userId, encodedName });

        // Parse et valide le body
        const body = await request.json();
        const validationResult = z.object({
            format: z.enum(["pdf", "docx"] as const),
            doc_name: z.string().optional(),
            cover_image: z.string().optional(), // Nouveau champ
        }).safeParse(body);

        if (!validationResult.success) {
            return errorResponse("Données invalides", JSON.stringify(validationResult.error.format()), 400);
        }

        const { format, doc_name, cover_image } = validationResult.data;

        // Vérifie que le projet existe et appartient à l'utilisateur (Robust Search)
        // Tentative 1: Recherche basée sur pr_name (peut échouer si sensibilités différentes)
        let project = await prisma.project.findFirst({
            where: {
                pr_name: pr_name,
                owner_id: userId,
            },
        });

        // Si non trouvé, tentative de récupération intelligente (insensible à la casse/accents)
        if (!project) {
            console.log(`⚠️ Projet '${pr_name}' non trouvé. Recherche approximative...`);

            const userProjects = await prisma.project.findMany({
                where: { owner_id: userId },
                select: { pr_id: true, pr_name: true }
            });

            // Normalisation NFC + Lowercase
            const targetName = pr_name.normalize('NFC').toLowerCase();
            const found = userProjects.find((p: { pr_name: string; pr_id: string }) => p.pr_name.normalize('NFC').toLowerCase() === targetName);

            if (found) {
                console.log(`✅ Projet retrouvé via normalisation: '${pr_name}' -> '${found.pr_name}'`);
                project = await prisma.project.findUnique({ where: { pr_id: found.pr_id } });
            } else {
                const availableNames = userProjects.map((p: { pr_name: string }) => p.pr_name).join(', ');
                console.error(`❌ Projet introuvable. Disponibles: [${availableNames}]`);
                return notFoundResponse(`Projet "${pr_name}" non trouvé. Vos projets disponibles : [${availableNames}]`);
            }
        }

        if (!project) {
            return notFoundResponse("Projet introuvable");
        }

        // Récupère la structure complète du projet
        console.log(`📡 [Publication] Fetching project data for ID: ${project.pr_id}`);
        const projectData = await getProjectForExport(project.pr_id, userId);

        if (!projectData) {
            console.error(`❌ [Publication] Failed to getProjectForExport for ID: ${project.pr_id}`);
            return notFoundResponse("Impossible de récupérer les données du projet");
        }

        // Ajoute l'image de couverture si présente
        if (cover_image) {
            projectData.cover_image = cover_image;
        }

        // Vérifie que le projet a du contenu
        if (projectData.parts.length === 0) {
            console.warn(`⚠️ [Publication] Project ${pr_name} is empty.`);
            return errorResponse(
                "Le projet est vide. Ajoutez du contenu avant de publier.",
                undefined,
                400
            );
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const finalDocName = doc_name || `${pr_name}_${timestamp}`;

        console.log(`📤 [Publication] Starting ${format.toUpperCase()} generation for: ${pr_name} (File: ${finalDocName})`);

        // Publie le document sur Supabase
        let publishResult;
        try {
            publishResult = await publishDocument(projectData, format);
            console.log(`✅ [Publication] Supabase upload result:`, publishResult);
        } catch (pubError: any) {
            console.error(`❌ [Publication] Error in publishDocument (${format}):`, pubError);
            return errorResponse(
                `Erreur lors de la génération/upload du document (${format})`,
                pubError.message || "Erreur inconnue",
                500
            );
        }

        // Estime le nombre de pages
        const estimatedPages = estimatePages(projectData);

        // Crée l'entrée dans la table Document
        let document;
        try {
            document = await prisma.document.create({
                data: {
                    doc_name: finalDocName,
                    pages: estimatedPages,
                    doc_size: publishResult.size,
                    url_content: publishResult.url,
                    cover_image: cover_image || null, // Sauvegarde l'image
                    pr_source: project.pr_id,
                    downloaded: 0,
                    consult: 0,
                },
            });
        } catch (dbError: any) {
            // Détecte les erreurs de contrainte unique (nom de document déjà utilisé)
            if (dbError.code === 'P2002' || dbError.message?.includes('unique constraint')) {
                console.error(`⚠️ [Publication] Nom de document déjà utilisé: ${finalDocName}`);
                return errorResponse(
                    `Ce nom de snapshot est déjà utilisé. Veuillez en choisir un autre.`,
                    `Le snapshot "${finalDocName}" existe déjà dans la bibliothèque`,
                    409
                );
            }
            // Autres erreurs de base de données
            throw dbError;
        }

        // Marquer le projet comme publié
        await prisma.project.update({
            where: { pr_id: project.pr_id },
            data: { is_published: true },
        });

        console.log(`✅ Document publié avec succès: ${document.doc_id}`);

        // 5. Invalider les caches
        await cacheService.delByPattern("library:all_documents*");
        await cacheService.del(`projects:user:${userId}`); // CRUCIAL pour le /account

        return successResponse(
            "Document publié avec succès",
            {
                document: {
                    doc_id: document.doc_id,
                    doc_name: document.doc_name,
                    url_content: document.url_content,
                    pages: document.pages,
                    doc_size: document.doc_size,
                    published_at: document.published_at,
                    format: format,
                },
            },
            201
        );
    } catch (error) {
        console.error("Erreur lors de la publication du document:", error);
        return errorResponse(
            "Une erreur est survenue lors de la publication du document",
            error instanceof Error ? error.message : undefined,
            500
        );
    }
}