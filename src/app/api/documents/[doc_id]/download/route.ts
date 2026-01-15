/**
 * @fileoverview Route API pour télécharger un document et incrémenter le compteur
 *
 * @swagger
 * /api/documents/{doc_id}/download:
 *   post:
 *     tags:
 *       - Documents
 *     summary: Télécharger un document
 *     description: Retourne l'URL de téléchargement et incrémente le compteur de téléchargements
 *     parameters:
 *       - in: path
 *         name: doc_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du document
 *     responses:
 *       200:
 *         description: URL de téléchargement retournée avec succès
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
} from "@/utils/api-response";

type RouteParams = {
    params: Promise<{ doc_id: string }>;
};

/**
 * Handler POST pour télécharger un document
 * @param request - Requête Next.js
 * @param context - Contexte avec les paramètres de route
 * @returns Réponse JSON avec l'URL de téléchargement
 */
export async function POST(request: NextRequest, context: RouteParams) {
    try {
        const { doc_id } = await context.params;

        console.log(`📥 Téléchargement du document: ${doc_id}`);

        // Récupère le document
        const document = await prisma.document.findUnique({
            where: { doc_id },
        });

        if (!document) {
            return notFoundResponse("Document non trouvé");
        }

        // Incrémenter le compteur de téléchargements
        const updatedDocument = await prisma.document.update({
            where: { doc_id },
            data: { downloaded: { increment: 1 } },
        });

        return successResponse("Téléchargement autorisé", {
            url: document.url_content,
            doc_name: document.doc_name,
            downloaded: updatedDocument.downloaded,
        });

    } catch (error) {
        console.error("Erreur lors du téléchargement du document:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors du téléchargement",
            error instanceof Error ? error.message : undefined
        );
    }
}
