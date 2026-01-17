/**
 * @fileoverview Route API pour l'exportation de documents
 * Génère et envoie directement le document au client sans le stocker
 *
 * @swagger
 * /api/projects/{pr_name}/export:
 *   get:
 *     tags:
 *       - Documents
 *     summary: Exporter un projet en PDF ou DOCX
 *     description: Génère un document et l'envoie directement au client pour téléchargement
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pr_name
 *         required: true
 *         schema:
 *           type: string
 *         description: Nom du projet
 *       - in: query
 *         name: format
 *         required: false
 *         schema:
 *           type: string
 *           enum: [pdf, docx]
 *           default: pdf
 *         description: Format du document à exporter
 *     responses:
 *       200:
 *         description: Document généré avec succès
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *           application/vnd.openxmlformats-officedocument.wordprocessingml.document:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Format invalide
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       401:
 *         description: Non autorisé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         description: Projet non trouvé
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

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getProjectForExport, generateDocument } from "@/lib/document-service";
import { errorResponse, notFoundResponse } from "@/utils/api-response";
import type { DocumentFormat } from "@/types/document.types";

type RouteParams = {
    params: Promise<{ pr_name: string }>;
};

/**
 * Handler GET pour exporter un projet
 * @param request - Requête Next.js avec query param "format"
 * @param context - Contexte avec les paramètres de route
 * @returns Stream du document généré
 */
export async function GET(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Utilisateur non authentifié", undefined, 401);
        }

        const { pr_name: encodedName } = await context.params;
        const pr_name = decodeURIComponent(encodedName);

        // Récupère le format depuis les query params (défaut: pdf)
        const { searchParams } = new URL(request.url);
        const format = (searchParams.get("format") || "pdf") as DocumentFormat;

        // Validation du format
        if (!["pdf", "docx"].includes(format)) {
            return errorResponse("Format invalide. Utilisez 'pdf' ou 'docx'", undefined, 400);
        }

        // Vérifie que le projet existe et appartient à l'utilisateur ou qu'il y est invité
        const project = await prisma.project.findFirst({
            where: {
                pr_name,
                OR: [
                    { owner_id: userId },
                    {
                        invitations: {
                            some: {
                                guest_id: userId,
                                status: "Accepted",
                            },
                        },
                    },
                ],
            },
        });

        if (!project) {
            return notFoundResponse("Projet non trouvé");
        }

        // Récupère la structure complète du projet
        const projectData = await getProjectForExport(project.pr_id, userId);

        if (!projectData) {
            return notFoundResponse("Impossible de récupérer les données du projet");
        }

        // Vérifie que le projet a du contenu
        if (projectData.parts.length === 0) {
            return errorResponse(
                "Le projet est vide. Ajoutez du contenu avant d'exporter.",
                undefined,
                400
            );
        }

        console.log(`📄 Génération du document ${format.toUpperCase()} pour le projet: ${pr_name}`);

        // Génère le document
        const documentStream = await generateDocument(projectData, format);

        // Prépare le nom du fichier
        const fileName = `${pr_name.replace(/[^a-z0-9]/gi, "_")}.${format}`;

        // Détermine le content-type
        const contentType =
            format === "pdf"
                ? "application/pdf"
                : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

        // Pour PDF (Stream)
        if (format === "pdf") {
            const readable = documentStream as NodeJS.ReadableStream;

            return new NextResponse(readable as never, {
                headers: {
                    "Content-Type": contentType,
                    "Content-Disposition": `attachment; filename="${fileName}"`,
                    "Cache-Control": "no-cache",
                },
            });
        }

        // Pour DOCX (Buffer)
        const buffer = documentStream as Buffer;

        return new NextResponse(new Uint8Array(buffer), {
            headers: {
                "Content-Type": contentType,
                "Content-Disposition": `attachment; filename="${fileName}"`,
                "Content-Length": buffer.length.toString(),
                "Cache-Control": "no-cache",
            },
        });
    } catch (error) {
        console.error("Erreur lors de l'exportation du document:", error);
        return errorResponse(
            "Une erreur est survenue lors de l'exportation du document",
            error instanceof Error ? error.message : undefined,
            500
        );
    }
}

