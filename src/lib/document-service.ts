/**
 * @fileoverview Service de génération et publication de documents
 * Gère l'export direct et la publication sur MinIO (S3-compatible)
 */

import prisma from "./prisma";
import { uploadObject, DOCUMENTS_BUCKET } from "./object-storage";
import { generatePDF } from "@/utils/pdf-generator";
import { generateDOCX } from "@/utils/docx-generator";
import type {
    ProjectForExport,
    DocumentFormat,
    PublishResult,
    PrismaProjectWithRelations,
} from "@/types/document.types";
import { PassThrough } from "stream";

/**
 * Récupère la structure complète d'un projet pour l'export
 */
export async function getProjectForExport(
    projectId: string,
    userId: string
): Promise<ProjectForExport | null> {
    const project = (await prisma.project.findFirst({
        where: {
            pr_id: projectId,
            OR: [
                { owner_id: userId },
                {
                    invitations: {
                        some: {
                            guest_id: userId,
                            invitation_state: "Accepted",
                        },
                    },
                },
            ],
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
    })) as PrismaProjectWithRelations | null;

    if (!project) return null;

    const projectForExport: ProjectForExport = {
        pr_name: project.pr_name,
        owner: project.owner,
        created_at: project.created_at,
        styles: project.styles,
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

export async function generateDocument(
    project: ProjectForExport,
    format: DocumentFormat
): Promise<PassThrough | Buffer> {
    if (format === "pdf") {
        return await generatePDF(project);
    }
    return await generateDOCX(project);
}

/**
 * Publie un document sur MinIO
 */
export async function publishDocument(
    project: ProjectForExport,
    format: DocumentFormat
): Promise<PublishResult> {
    const documentData = await generateDocument(project, format);

    const timestamp = Date.now();
    const fileName = `${project.pr_name.replace(/[^a-z0-9]/gi, "_")}_${timestamp}.${format}`;
    const filePath = `documents/${fileName}`;

    let buffer: Buffer;
    if (documentData instanceof PassThrough) {
        const chunks: Buffer[] = [];
        for await (const chunk of documentData) {
            chunks.push(chunk);
        }
        buffer = Buffer.concat(chunks);
    } else {
        buffer = documentData;
    }

    const contentType =
        format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    const uploaded = await uploadObject(DOCUMENTS_BUCKET, filePath, buffer, contentType);

    return {
        success: true,
        url: uploaded.url,
        fileName,
        size: buffer.length,
        format,
    };
}
