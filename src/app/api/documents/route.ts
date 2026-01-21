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
export async function GET(request: NextRequest) {
    try {
        console.log("📚 Récupération de tous les documents publiés");

        // Récupérer les paramètres de pagination
        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '20', 10);
        const skip = (page - 1) * limit;

        const cacheKey = `library:all_documents:page${page}:limit${limit}`;

        // 1. Essayer de récupérer le résultat depuis le cache Redis
        const cachedData = await cacheService.get<{ documents: any[], count: number, totalCount: number, hasMore: boolean }>(cacheKey);
        if (cachedData) {
            console.log("⚡ Cache hit for library documents (page " + page + ")");
            return successResponse("Documents récupérés avec succès (cache)", cachedData);
        }

        console.log("🐢 Cache miss, querying MongoDB...");

        // 2. Compter le total de documents
        const totalCount = await prisma.document.count();

        // 3. Récupérer les documents avec pagination
        const documents = await prisma.document.findMany({
            skip,
            take: limit,
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

        // 4. Formater les documents pour le frontend
        const formattedDocuments = documents.map((doc: any) => ({
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
            cover_image: doc.cover_image,
        }));

        const result = {
            documents: formattedDocuments,
            count: formattedDocuments.length,
            totalCount,
            hasMore: skip + limit < totalCount,
            currentPage: page,
        };

        // 5. Mettre en cache pour les prochaines requêtes
        await cacheService.set(cacheKey, result, CACHE_TTL);

        return successResponse("Documents récupérés avec succès", result);

    } catch (error) {
        console.error("Erreur lors de la récupération des documents:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la récupération des documents",
            error instanceof Error ? error.message : undefined
        );
    }
}
