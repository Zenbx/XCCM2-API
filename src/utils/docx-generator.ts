/**
 * @fileoverview Générateur de documents DOCX
 * Utilise docx pour créer des fichiers Word avec styles
 */

import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    TableOfContents,
    PageBreak,
    ImageRun,
    ExternalHyperlink,
} from "docx";
import type { ProjectForExport } from "@/types/document.types";
import { parseMarkdownToSegments, htmlToPlainText } from "./markdown-parser";

/**
 * Génère un document DOCX à partir d'un projet
 * @param project - Projet avec toute sa structure
 * @returns Buffer du document DOCX
 */
export async function generateDOCX(project: ProjectForExport): Promise<Buffer> {
    const coverPage: Paragraph[] = [];

    // Ajout de l'image de couverture si présente
    if (project.cover_image) {
        try {
            const response = await fetch(project.cover_image);
            if (response.ok) {
                const imageBuffer = Buffer.from(await response.arrayBuffer());

                coverPage.push(
                    new Paragraph({
                        children: [
                            new ImageRun({
                                data: imageBuffer,
                                transformation: {
                                    width: 400,
                                    height: 300,
                                },
                            } as any),
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 400, after: 400 },
                    })
                );
            }
        } catch (error) {
            console.error("❌ Erreur lors du téléchargement de l'image de couverture pour DOCX:", error);
        }
    }

    coverPage.push(
        new Paragraph({
            text: project.pr_name,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
        }),
        new Paragraph({
            text: `Auteur: ${project.owner.firstname} ${project.owner.lastname}`,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
        }),
        new Paragraph({
            text: `Email: ${project.owner.email}`,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
        }),
        new Paragraph({
            text: `Date: ${new Date(project.created_at).toLocaleDateString("fr-FR")}`,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
        })
    );

    // ===== TABLE DES MATIÈRES =====
    const tableOfContents = new TableOfContents("Sommaire", {
        hyperlink: true,
        headingStyleRange: "1-2",
    });

    // ===== CONTENU =====
    const content: Paragraph[] = [];

    project.parts.forEach((part, partIndex) => {
        // SAUT DE PAGE AVANT CHAQUE PARTIE (sauf la première)
        if (partIndex > 0) {
            content.push(
                new Paragraph({
                    children: [new PageBreak()],
                })
            );
        }

        // Titre de la partie (souligné)
        content.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: `Partie ${part.part_number}: ${part.part_title}`,
                        underline: {}, // Le soulignement se met ici
                    }),
                ],
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 },
            })
        );

        // Introduction de la partie
        if (part.part_intro) {
            content.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: part.part_intro,
                            italics: true, // L'italique se met ici
                        }),
                    ],
                    spacing: { after: 300 },
                    alignment: AlignmentType.JUSTIFIED,
                })
            );
        }

        // Chapitres
        part.chapters.forEach((chapter, chapterIndex) => {
            // SAUT DE PAGE AVANT CHAQUE CHAPITRE (sauf le premier de la partie)
            if (chapterIndex > 0) {
                content.push(
                    new Paragraph({
                        children: [new PageBreak()],
                    })
                );
            }

            // Titre du chapitre (Format: "Chapitre X: Titre", souligné)
            content.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `Chapitre ${chapter.chapter_number}: ${chapter.chapter_title}`,
                            underline: {}, // Le soulignement se met ici
                        }),
                    ],
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 300, after: 150 },
                })
            );

            // Paragraphes
            chapter.paragraphs.forEach((paragraph) => {
                // Titre du paragraphe
                content.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: paragraph.para_name,
                                bold: true,
                                size: 28, // 14pt
                            }),
                        ],
                        spacing: { before: 200, after: 100 },
                    })
                );

                // Notions
                paragraph.notions.forEach((notion) => {
                    // Nom de la notion (si présent)
                    if (notion.notion_name) {
                        content.push(
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: notion.notion_name,
                                        bold: true,
                                        italics: true,
                                        color: "666666",
                                        size: 24, // 12pt
                                    }),
                                ],
                                spacing: { before: 100, after: 50 },
                            })
                        );
                    }

                    // Contenu de la notion
                    const plainText = htmlToPlainText(notion.notion_content || '');
                    const lines = plainText.split('\n');
                    const children = lines.map((line, index) =>
                        new TextRun({
                            text: line,
                            break: index > 0 ? 1 : 0
                        })
                    );

                    content.push(
                        new Paragraph({
                            children,
                            spacing: { after: 200 },
                            alignment: AlignmentType.JUSTIFIED,
                        })
                    );
                });
            });
        });
    });

    // ===== CRÉATION DU DOCUMENT =====
    const doc = new Document({
        sections: [
            {
                children: [...coverPage, tableOfContents, ...content],
            },
        ],
    });

    // Générer le buffer
    const buffer = await Packer.toBuffer(doc);
    return buffer;
}
