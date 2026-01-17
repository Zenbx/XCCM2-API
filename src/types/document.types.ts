/**
 * @fileoverview Types TypeScript pour la génération de documents
 * Définit les interfaces pour l'exportation et la publication
 */

/**
 * Format de document supporté
 */
export type DocumentFormat = "pdf" | "docx";

/**
 * Structure complète d'un projet pour la génération de document
 */
export interface ProjectForExport {
    pr_name: string;
    owner: {
        firstname: string;
        lastname: string;
        email: string;
    };
    created_at: Date;
    styles?: any;
    parts: PartForExport[];
}

/**
 * Structure d'une partie pour l'export
 */
export interface PartForExport {
    part_number: number;
    part_title: string;
    part_intro?: string | null;
    chapters: ChapterForExport[];
}

/**
 * Structure d'un chapitre pour l'export
 */
export interface ChapterForExport {
    chapter_number: number;
    chapter_title: string;
    paragraphs: ParagraphForExport[];
}

/**
 * Structure d'un paragraphe pour l'export
 */
export interface ParagraphForExport {
    para_number: number;
    para_name: string;
    notions: NotionForExport[];
}

/**
 * Structure d'une notion pour l'export
 */
export interface NotionForExport {
    notion_number: number;
    notion_name: string;
    notion_content: string; // Format Markdown
}

/**
 * Options de génération de document
 */
export interface DocumentGenerationOptions {
    format: DocumentFormat;
    includeTableOfContents?: boolean;
    includeMetadata?: boolean;
}

/**
 * Résultat de la publication d'un document
 */
export interface PublishResult {
    success: boolean;
    url: string;
    fileName: string;
    size: number;
    format: DocumentFormat;
}
/**
 * Type utilitaire pour le résultat Prisma de getProjectForExport
 */
export type PrismaProjectWithRelations = {
    pr_id: string;
    pr_name: string;
    owner_id: string;
    created_at: Date;
    updated_at: Date;
    styles: any;
    owner: {
        firstname: string;
        lastname: string;
        email: string;
    };
    parts: Array<{
        part_id: string;
        part_number: number;
        part_title: string;
        part_intro: string | null;
        parent_pr: string;
        chapters: Array<{
            chapter_id: string;
            chapter_number: number;
            chapter_title: string;
            parent_part: string;
            paragraphs: Array<{
                para_id: string;
                para_number: number;
                para_name: string;
                parent_chapter: string;
                notions: Array<{
                    notion_id: string;
                    notion_number: number;
                    notion_name: string;
                    notion_content: string;
                    parent_para: string;
                }>;
            }>;
        }>;
    }>;
};