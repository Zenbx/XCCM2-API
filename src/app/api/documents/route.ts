/**
 * @fileoverview Route API publique pour lister les documents publiés
 *
 * @swagger
 * /api/documents:
 *   get:
 *     tags:
 *       - Documents
 *     summary: Récupérer la liste des documents publiés
 *     description: Retourne une liste de tous les projets qui ont été publiés, destinée à la bibliothèque publique.
 *     responses:
 *       200:
 *         description: Liste des documents récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     documents:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Project' # On retourne directement les projets publiés
 *       500:
 *         description: Erreur serveur
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    serverErrorResponse,
} from "@/utils/api-response";

/**
 * Handler GET pour récupérer tous les documents publiés (vrais documents générés)
 * @param request - Requête Next.js
 * @returns Réponse JSON avec la liste des documents publiés
 */
export async function GET(request: NextRequest) {
    try {
        console.log("📚 Récupération des documents publiés pour la bibliothèque");

        // Récupère les vrais documents de la table Document avec les infos du projet source
        const publishedDocuments = await prisma.document.findMany({
            orderBy: {
                published_at: "desc", // Les plus récents d'abord
            },
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

        // Transforme les données pour correspondre au format attendu par le front
        const documents = publishedDocuments.map((doc) => ({
            doc_id: doc.doc_id,
            doc_name: doc.doc_name,
            url_content: doc.url_content,
            pages: doc.pages,
            doc_size: doc.doc_size,
            published_at: doc.published_at,
            downloaded: doc.downloaded,
            consult: doc.consult,
            // Infos du projet source
            pr_id: doc.project.pr_id,
            pr_name: doc.project.pr_name,
            description: doc.project.description,
            category: doc.project.category,
            level: doc.project.level,
            tags: doc.project.tags,
            author: doc.project.author ||
                `${doc.project.owner.firstname} ${doc.project.owner.lastname}`.trim(),
        }));

        return successResponse("Documents publiés récupérés avec succès", {
            documents,
        });

    } catch (error) {
        console.error("Erreur lors de la récupération des documents publiés:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la récupération des documents",
            error instanceof Error ? error.message : undefined
        );
    }
}
