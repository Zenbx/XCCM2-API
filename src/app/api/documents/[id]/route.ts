/**
 * @fileoverview Route API pour récupérer un document spécifique avec sa structure complète
 *
 * @swagger
 * /api/documents/{id}:
 *   get:
 *     tags:
 *       - Documents
 *     summary: Récupérer un document par ID avec la structure du projet
 *     description: Retourne les métadonnées du document ET la structure complète du projet source pour le book-reader
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du document
 *     responses:
 *       200:
 *         description: Document récupéré avec succès
 *       404:
 *         description: Document non trouvé
 *       500:
 *         description: Erreur serveur
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    notFoundResponse,
    serverErrorResponse,
    errorResponse,
} from "@/utils/api-response";
import { verifyToken, extractTokenFromHeader } from "@/lib/auth";
import { cacheService } from "@/services/cache-service";

type RouteParams = {
    params: Promise<{ id: string }>;
};

/**
 * Handler GET pour récupérer un document avec la structure complète du projet
 * @param request - Requête Next.js
 * @param context - Contexte avec les paramètres de route
 * @returns Réponse JSON avec le document et sa structure
 */
export async function GET(_request: NextRequest, context: RouteParams) {
    try {
        const { id: doc_id } = await context.params;

        console.log(`📖 Récupération du document: ${doc_id}`);

        // Récupérer le userId si connecté
        const authHeader = _request.headers.get("Authorization");
        const token = extractTokenFromHeader(authHeader);
        let currentUserId: string | null = null;
        if (token) {
            const payload = await verifyToken(token);
            if (payload) currentUserId = payload.userId;
        }

        // Récupère le document avec les infos du projet source
        const document = await prisma.document.findUnique({
            where: { doc_id },
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

        if (!document) {
            return notFoundResponse("Document non trouvé");
        }

        // Incrémenter le compteur de consultations
        await prisma.document.update({
            where: { doc_id },
            data: { consult: { increment: 1 } },
        });

        // Récupérer la structure complète du projet source
        const projectId = document.pr_source;

        // Récupérer toutes les parties avec leurs enfants
        const parts = await prisma.part.findMany({
            where: { parent_pr: projectId },
            orderBy: { part_number: "asc" },
            include: {
                chapters: {
                    orderBy: { chapter_number: "asc" },
                    include: {
                        paragraphs: {
                            orderBy: { para_number: "asc" },
                            include: {
                                notions: {
                                    orderBy: { notion_number: "asc" },
                                },
                            },
                        },
                    },
                },
            },
        });

        // Construire la réponse avec le document et la structure
        const response = {
            document: {
                doc_id: document.doc_id,
                doc_name: document.doc_name,
                url_content: document.url_content,
                pages: document.pages,
                doc_size: document.doc_size,
                published_at: document.published_at,
                downloaded: document.downloaded,
                consult: document.consult,
                likes: document.likes.length,
                isLiked: currentUserId ? document.likes.some((like: any) => like.liker_id === currentUserId) : false,
            },
            project: {
                pr_id: document.project.pr_id,
                pr_name: document.project.pr_name,
                description: document.project.description,
                category: document.project.category,
                level: document.project.level,
                author: document.project.author ||
                    `${document.project.owner.firstname} ${document.project.owner.lastname}`.trim(),
                language: document.project.language,
                tags: document.project.tags,
                styles: document.project.styles,
            },
            structure: parts.map((part) => ({
                part_id: part.part_id,
                part_title: part.part_title,
                part_number: part.part_number,
                part_intro: part.part_intro,
                chapters: part.chapters.map((chapter) => ({
                    chapter_id: chapter.chapter_id,
                    chapter_title: chapter.chapter_title,
                    chapter_number: chapter.chapter_number,
                    paragraphs: chapter.paragraphs.map((paragraph) => ({
                        para_id: paragraph.para_id,
                        para_name: paragraph.para_name,
                        para_number: paragraph.para_number,
                        notions: paragraph.notions.map((notion) => ({
                            notion_id: notion.notion_id,
                            notion_name: notion.notion_name,
                            notion_number: notion.notion_number,
                            notion_content: notion.notion_content,
                        })),
                    })),
                })),
            })),
        };

        return successResponse("Document récupéré avec succès", response);

    } catch (error) {
        console.error("Erreur lors de la récupération du document:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la récupération du document",
            error instanceof Error ? error.message : undefined
        );
    }
}

/**
 * DELETE /api/documents/[id]
 * Dépublie un document (supprime le snapshot de la bibliothèque)
 */
export async function DELETE(_request: NextRequest, context: RouteParams) {
    try {
        const { id: doc_id } = await context.params;

        // 1. Authentification
        const authHeader = _request.headers.get("Authorization");
        const token = extractTokenFromHeader(authHeader);
        if (!token) return errorResponse("Authentification requise", undefined, 401);

        const payload = await verifyToken(token);
        if (!payload) return errorResponse("Token invalide", undefined, 401);
        const currentUserId = payload.userId;
        const userRole = _request.headers.get("x-user-role");

        // 2. Récupérer le document
        const document = await prisma.document.findUnique({
            where: { doc_id },
            include: { project: true }
        });

        if (!document) {
            return notFoundResponse("Document non trouvé");
        }

        // 3. Vérifier les droits (Owner du projet ou Admin)
        const isOwner = document.project.owner_id === currentUserId;
        const isAdmin = userRole === "admin";

        if (!isOwner && !isAdmin) {
            return errorResponse("Vous n'avez pas le droit de dépublier ce document", undefined, 403);
        }

        // 4. Suppression
        await prisma.document.delete({
            where: { doc_id }
        });

        console.log(`🗑️ Document dépublié par ${isOwner ? 'auteur' : 'admin'}: ${doc_id}`);

        // 5. Invalider les caches
        await cacheService.delByPattern("library:all_documents*");
        await cacheService.del(`projects:user:${document.project.owner_id}`);

        return successResponse("Document dépublié avec succès");

    } catch (error) {
        console.error("Erreur lors de la dépublication:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la dépublication",
            error instanceof Error ? error.message : undefined
        );
    }
}
