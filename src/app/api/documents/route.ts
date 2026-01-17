/**
 * @fileoverview Route API pour lister tous les documents publiés
 *
 * @swagger
 * /api/documents:
 *   get:
 *     tags:
 *       - Documents
 *     summary: Récupérer tous les documents publiés
 *     description: Retourne la liste des documents publiés avec les infos du projet
 *     responses:
 *       200:
 *         description: Documents récupérés avec succès
 *       500:
 *         description: Erreur serveur
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { cacheService } from "@/services/cache-service";
import {
    successResponse,
    serverErrorResponse,
} from "@/utils/api-response";

const DOCUMENTS_CACHE_KEY = "library:all_documents";
const CACHE_TTL = 1800; // 30 minutes

/**
 * Handler GET pour lister tous les documents publiés
 * @param request - Requête Next.js
 * @returns Réponse JSON avec la liste des documents
 */
export async function GET(_request: NextRequest) {
    try {
        console.log("📚 Récupération de tous les documents publiés");

        // 1. Essayer de récupérer le résultat depuis le cache Redis
        const cachedData = await cacheService.get<{ documents: any[], count: number }>(DOCUMENTS_CACHE_KEY);
        if (cachedData) {
            console.log("⚡ Cache hit for library documents");
            return successResponse("Documents récupérés avec succès (cache)", cachedData);
        }

        console.log("🐢 Cache miss, querying MongoDB...");

        // 2. Récupérer tous les documents avec les infos du projet
        const documents = await prisma.document.findMany({
            orderBy: { published_at: "desc" },
            include: {
                project: {
                    include: {
                        owner: {
                            select: {
                                firstname: true,
                                lastname: true,
                            },
                        },
                    },
                },
            },
        });

        // 3. Formater les documents pour le frontend
        const formattedDocuments = documents.map((doc) => ({
            doc_id: doc.doc_id,
            doc_name: doc.doc_name,
            url_content: doc.url_content,
            pages: doc.pages,
            doc_size: doc.doc_size,
            published_at: doc.published_at,
            downloaded: doc.downloaded,
            consult: doc.consult,
            // Infos du projet
            category: doc.project.category,
            level: doc.project.level,
            description: doc.project.description,
            author: doc.project.author ||
                `${doc.project.owner.firstname} ${doc.project.owner.lastname}`.trim(),
            tags: doc.project.tags,
        }));

        const result = {
            documents: formattedDocuments,
            count: formattedDocuments.length,
        };

        // 4. Mettre en cache pour les prochaines requêtes
        await cacheService.set(DOCUMENTS_CACHE_KEY, result, CACHE_TTL);

        return successResponse("Documents récupérés avec succès", result);

    } catch (error) {
        console.error("Erreur lors de la récupération des documents:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la récupération des documents",
            error instanceof Error ? error.message : undefined
        );
    }
}
