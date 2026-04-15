/**
 * @fileoverview Route API pour lister tous les documents publiés
 */
/**
 * @openapi
 * /api/documents:
 *   get:
 *     tags:
 *       - Documents
 *     summary: Récupérer tous les documents publiés (Bilbiothèque/Library)
 *     description: Retourne la liste paginée de tous les documents publiés sur la plateforme.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Numéro de la page
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *         description: Nombre d'éléments par page
 *     responses:
 *       200:
 *         description: Liste des documents récupérée
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     documents:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Document' }
 *                     totalCount: { type: integer }
 *                     hasMore: { type: boolean }
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { cacheService } from "@/services/cache-service";
import {
    successResponse,
    serverErrorResponse,
} from "@/utils/api-response";
import { verifyToken, extractTokenFromHeader } from "@/lib/auth";

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

        // Récupérer le userId si connecté
        const authHeader = request.headers.get("Authorization");
        const token = extractTokenFromHeader(authHeader);
        let currentUserId: string | null = null;
        if (token) {
            const payload = await verifyToken(token);
            if (payload) currentUserId = payload.userId;
        }

        const cacheKey = `library:all_documents:page${page}:limit${limit}`;

        // 1. Essayer de récupérer le résultat depuis le cache Redis
        const cachedData = await cacheService.get<{ documents: any[], count: number, totalCount: number, hasMore: boolean }>(cacheKey);
        if (cachedData && !currentUserId) {
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
                likes: true, // Inclure les likes pour le compte
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
            likes: doc.likes.length,
            isLiked: currentUserId ? doc.likes.some((like: any) => like.liker_id === currentUserId) : false,
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
