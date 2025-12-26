/**
 * @fileoverview Types TypeScript pour les granules (Part, Chapter, Paragraph, Notion)
 * Définit les interfaces pour tous les niveaux de granules
 */

/**
 * Interface pour une Partie (Part)
 */
export interface Part {
    part_id: string;
    part_title: string;
    part_intro?: string | null;
    part_number: number;
    parent_pr: string;
}

/**
 * Interface pour un Chapitre (Chapter)
 */
export interface Chapter {
    chapter_id: string;
    chapter_title: string;
    chapter_number: number;
    parent_part: string;
}

/**
 * Interface pour un Paragraphe (Paragraph)
 */
export interface Paragraph {
    para_id: string;
    para_name: string;
    para_number: string;
    parent_chapter: string;
}

/**
 * Interface pour une Notion
 */
export interface Notion {
    notion_id: string;
    notion_name: string;
    notion_content: string;
    parent_para: string;
}

/**
 * Corps de la requête de création de Part
 */
export interface CreatePartRequest {
    part_title: string;
    part_intro?: string;
    part_number: number;
}

/**
 * Corps de la requête de modification de Part
 */
export interface UpdatePartRequest {
    part_title?: string;
    part_intro?: string;
    part_number?: number;
}

/**
 * Corps de la requête de création de Chapter
 */
export interface CreateChapterRequest {
    chapter_title: string;
    chapter_number: number;
}

/**
 * Corps de la requête de modification de Chapter
 */
export interface UpdateChapterRequest {
    chapter_title?: string;
    chapter_number?: number;
}

/**
 * Corps de la requête de création de Paragraph
 */
export interface CreateParagraphRequest {
    para_name: string;
    para_number: string;
}

/**
 * Corps de la requête de modification de Paragraph
 */
export interface UpdateParagraphRequest {
    para_name?: string;
    para_number?: string;
}

/**
 * Corps de la requête de création de Notion
 */
export interface CreateNotionRequest {
    notion_name: string;
    notion_content: string;
}

/**
 * Corps de la requête de modification de Notion
 */
export interface UpdateNotionRequest {
    notion_name?: string;
    notion_content?: string;
}