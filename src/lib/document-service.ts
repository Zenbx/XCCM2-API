/**
 * @fileoverview Service de génération et publication de documents
 * Gère l'export direct et la publication sur Supabase Storage
 */

import prisma from "./prisma";
import { supabase, DOCUMENTS_BUCKET } from "./supabase";
import { generatePDF } from "@/utils/pdf-generator";
import { generateDOCX } from "@/utils/docx-generator";
import type {
    ProjectForExport,
    DocumentFormat,
    PublishResult,
} from "@/types/document.types";
import { PassThrough } from "stream";

/**
 * Récupère la structure complète d'un projet pour l'export
 * @param projectId - ID du projet
 * @param userId - ID de l'utilisateur (vérification de propriété)
 * @returns Projet complet avec toute sa hiérarchie
 */
export async function getProjectForExport(
    projectId: string,
    userId: string
): Promise<ProjectForExport | null> {
    const project = await prisma.project.findFirst({
        where: {
            pr_id: projectId,
            owner_id: userId,
        },
        include: {
            owner: {
                select: {
                    firstname: true,
                    lastname: true,
                    email: true,
                },
            },
            parts: {
                orderBy: {
                    part_number: "asc",
                },
                include: {
                    chapters: {
                        orderBy: {
                            chapter_number: "asc",
                        },
                        include: {
                            paragraphs: {
                                orderBy: {
                                    para_number: "asc",
                                },
                                include: {
                                    notions: {
                                        orderBy: {
                                            notion_number: "asc",
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!project) return null;

    // Transformation explicite avec typage strict
    const projectForExport: ProjectForExport = {
        pr_name: project.pr_name,
        owner: project.owner,
        created_at: project.created_at,
        parts: project.parts.map((part) => ({
            part_number: part.part_number,
            part_title: part.part_title,
            part_intro: part.part_intro,
            chapters: part.chapters.map((chapter) => ({
                chapter_number: chapter.chapter_number,
                chapter_title: chapter.chapter_title,
                paragraphs: chapter.paragraphs.map((paragraph) => ({
                    para_number: paragraph.para_number,
                    para_name: paragraph.para_name,
                    notions: paragraph.notions.map((notion) => ({
                        notion_number: notion.notion_number,
                        notion_name: notion.notion_name,
                        notion_content: notion.notion_content,
                    })),
                })),
            })),
        })),
    };

    return projectForExport;
}

/**
 * Génère un document dans le format spécifié
 * @param project - Projet à exporter
 * @param format - Format du document (pdf ou docx)
 * @returns Stream ou Buffer du document généré
 */
export async function generateDocument(
    project: ProjectForExport,
    format: DocumentFormat
): Promise<PassThrough | Buffer> {
    if (format === "pdf") {
        return await generatePDF(project);
    } else {
        return await generateDOCX(project);
    }
}

/**
 * Publie un document sur Supabase Storage
 * @param project - Projet à publier
 * @param format - Format du document
 * @returns Résultat de la publication avec l'URL publique
 */
export async function publishDocument(
    project: ProjectForExport,
    format: DocumentFormat
): Promise<PublishResult> {
    // Générer le document
    const documentData = await generateDocument(project, format);

    // Préparer le nom du fichier
    const timestamp = Date.now();
    const fileName = `${project.pr_name.replace(/[^a-z0-9]/gi, "_")}_${timestamp}.${format}`;
    const filePath = `documents/${fileName}`;

    // Convertir en Buffer si nécessaire
    let buffer: Buffer;
    if (documentData instanceof PassThrough) {
        // Pour PDF (stream)
        const chunks: Buffer[] = [];
        for await (const chunk of documentData) {
            chunks.push(chunk);
        }
        buffer = Buffer.concat(chunks);
    } else {
        // Pour DOCX (déjà un buffer)
        buffer = documentData;
    }

    // Upload vers Supabase Storage
    const { data, error } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(filePath, buffer, {
            contentType:
                format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            upsert: false,
        });

    if (error) {
        throw new Error(`Erreur lors de l'upload sur Supabase: ${error.message}`);
    }

    // Obtenir l'URL publique
    const { data: publicUrlData } = supabase.storage
        .from(DOCUMENTS_BUCKET)
        .getPublicUrl(filePath);

    return {
        success: true,
        url: publicUrlData.publicUrl,
        fileName,
        size: buffer.length,
        format,
    };
}