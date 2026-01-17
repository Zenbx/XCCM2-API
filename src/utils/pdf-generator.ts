/**
 * @fileoverview Générateur de documents PDF à partir de HTML
 * Utilise Puppeteer pour une conversion HTML -> PDF haute fidélité
 */

import puppeteer from "puppeteer";
import { PassThrough } from "stream";
import type { ProjectForExport } from "@/types/document.types";

/**
 * Génère le contenu HTML complet d'un projet, en s'inspirant du style de la page de prévisualisation.
 * @param project - Les données complètes du projet.
 * @returns Une chaîne de caractères contenant le HTML complet du document.
 */
function generatePrintableHTML(project: ProjectForExport): string {
    const { pr_name, owner, parts, styles } = project;

    const getCssFromStyleConfig = (config: any) => {
        if (!config) return "";
        let css = "";
        if (config.fontFamily)
            css += `font-family: "${config.fontFamily}", sans-serif !important; `;
        if (config.fontSize) css += `font-size: ${config.fontSize}px !important; `;
        if (config.color) css += `color: ${config.color} !important; `;
        if (config.fontWeight) css += `font-weight: ${config.fontWeight} !important; `;
        if (config.fontStyle) css += `font-style: ${config.fontStyle} !important; `;
        return css;
    };

    const css = `
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

            @media print {
                @page {
                    margin: 2cm;
                    size: A4;
                }
                body {
                    margin: 0;
                    -webkit-print-color-adjust: exact;
                }
            }
            
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            body {
                font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
                background-color: #ffffff;
                color: #111827;
                line-height: 1.6;
                font-size: 11pt;
            }

            .page-break {
                page-break-before: always;
            }

            .cover-page {
                height: 25.7cm; /* A4 height minus margins roughly */
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
                border: 1px solid #f3f4f6;
                position: relative;
            }

            .cover-logo {
                width: 120px;
                height: 120px;
                background-color: rgba(153, 51, 76, 0.05);
                border-radius: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 2rem;
            }

            .cover-logo span {
                font-size: 64px;
                color: #99334C;
            }

            .cover-title {
                font-size: 42pt;
                font-weight: 800;
                color: #111827;
                margin-bottom: 1rem;
                line-height: 1.1;
                letter-spacing: -0.02em;
            }

            .cover-subtitle {
                font-size: 18pt;
                color: #4B5563;
                margin-bottom: 3rem;
                font-weight: 400;
            }

            .cover-meta {
                display: flex;
                gap: 2rem;
                margin-bottom: 4rem;
                color: #6B7280;
                font-size: 12pt;
            }

            .cover-footer {
                position: absolute;
                bottom: 2rem;
                width: 100%;
                border-top: 1px solid #f3f4f6;
                padding-top: 1.5rem;
                color: #9CA3AF;
                font-size: 10pt;
                text-transform: uppercase;
                letter-spacing: 0.1em;
            }

            .toc-title {
                font-size: 24pt;
                font-weight: 700;
                color: #99334C;
                margin-bottom: 2rem;
                border-bottom: 2px solid rgba(153, 51, 76, 0.1);
                padding-bottom: 1rem;
            }

            .toc-item {
                display: flex;
                justify-content: space-between;
                align-items: baseline;
                margin-bottom: 0.8rem;
            }

            .toc-item.part {
                font-weight: 700;
                font-size: 14pt;
                margin-top: 2rem;
                color: #111827;
            }

            .toc-item.chapter {
                margin-left: 1.5rem;
                font-size: 12pt;
                color: #4B5563;
            }

            .part-header {
                margin-bottom: 3rem;
                padding-bottom: 1.5rem;
                border-bottom: 3px solid rgba(153, 51, 76, 0.2);
            }

            .part-badge {
                display: inline-block;
                background-color: #99334C;
                color: white;
                padding: 4px 16px;
                border-radius: 9999px;
                font-size: 10pt;
                font-weight: 700;
                text-transform: uppercase;
                margin-bottom: 1rem;
            }

            .part-title {
                font-size: 32pt;
                font-weight: 800;
                color: #111827;
                ${getCssFromStyleConfig(styles?.part?.title)}
            }

            .part-intro {
                font-size: 14pt;
                color: #4B5563;
                font-style: italic;
                line-height: 1.7;
                margin-bottom: 3rem;
                border-left: 4px solid rgba(153, 51, 76, 0.2);
                padding-left: 1.5rem;
                ${getCssFromStyleConfig(styles?.part?.intro)}
            }

            .chapter-title {
                font-size: 24pt;
                font-weight: 700;
                color: #111827;
                margin: 3rem 0 1.5rem 0;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                ${getCssFromStyleConfig(styles?.chapter?.title)}
            }

            .chapter-number {
                color: rgba(153, 51, 76, 0.3);
                font-weight: 400;
            }

            .paragraph-title {
                font-size: 18pt;
                font-weight: 700;
                color: #1F2937;
                margin: 2rem 0 1rem 0;
            }

            .notion-header {
                font-size: 9pt;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: #6B7280;
                margin-bottom: 0.8rem;
                border-bottom: 1px solid #f3f4f6;
                padding-bottom: 0.3rem;
                display: inline-block;
            }

            /* Prose-like styling for content */
            .prose-content {
                color: #374151;
                margin-bottom: 2.5rem;
            }

            .prose-content p {
                margin-bottom: 1.2rem;
            }

            .prose-content ul, .prose-content ol {
                margin-left: 1.5rem;
                margin-bottom: 1.2rem;
            }

            .prose-content li {
                margin-bottom: 0.5rem;
            }

            .prose-content blockquote {
                border-left: 4px solid rgba(153, 51, 76, 0.2);
                padding-left: 1.2rem;
                font-style: italic;
                color: #4B5563;
                margin: 1.5rem 0;
            }

            .prose-content strong {
                font-weight: 700;
                color: #111827;
            }

            .prose-content pre {
                background: #f9fafb;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                padding: 1rem;
                font-family: monospace;
                font-size: 9pt;
                overflow-x: auto;
                margin: 1.5rem 0;
            }

            .prose-content table {
                width: 100%;
                border-collapse: collapse;
                margin: 1.5rem 0;
            }

            .prose-content th, .prose-content td {
                border: 1px solid #e5e7eb;
                padding: 0.8rem;
                text-align: left;
            }

            .prose-content th {
                background: #f9fafb;
                font-weight: 600;
            }

            .prose-content img {
                max-width: 100%;
                height: auto;
                border-radius: 8px;
                margin: 1.5rem 0;
            }
        </style>
    `;

    let bodyContent = "";

    // 1. Page de garde (Cover Page)
    bodyContent += `
        <div class="cover-page">
            <div class="cover-logo">
                <span>📖</span>
            </div>
            <h1 class="cover-title">${pr_name.toUpperCase()}</h1>
            <p class="cover-subtitle">Document de Composition de Cours</p>
            
            <div class="cover-meta">
                <div><strong>Auteur:</strong> ${owner.firstname} ${owner.lastname}</div>
                <div><strong>Date:</strong> ${new Date().toLocaleDateString("fr-FR")}</div>
            </div>

            <div class="cover-footer">
                XCCM 2 • Système de Gestion de Contenu de Cours
            </div>
        </div>
    `;

    // 2. Table des matières (TOC)
    if (parts.length > 0) {
        bodyContent += `
            <div class="page-break">
                <h2 class="toc-title">Table des matières</h2>
                <div class="toc-container">
                    ${parts
                .map(
                    (part, pIdx) => `
                        <div class="toc-item part">
                            <span>Partie ${pIdx + 1}: ${part.part_title}</span>
                        </div>
                        ${part.chapters
                            ?.map(
                                (chap) => `
                            <div class="toc-item chapter">
                                <span>${chap.chapter_title}</span>
                            </div>
                        `
                            )
                            .join("") || ""
                        }
                    `
                )
                .join("")}
                </div>
            </div>
        `;
    }

    // 3. Contenu principal (Main Content)
    parts.forEach((part, partIndex) => {
        // Chaque partie commence sur une nouvelle page
        bodyContent += `<div class="page-break">`;

        // Header de partie
        bodyContent += `
            <div class="part-header">
                <span class="part-badge">Partie ${part.part_number}</span>
                <h2 class="part-title">${part.part_title}</h2>
            </div>
        `;

        // Intro de partie
        if (part.part_intro) {
            bodyContent += `<div class="part-intro">${part.part_intro}</div>`;
        }

        // Chapitres
        part.chapters?.forEach((chapter) => {
            bodyContent += `
                <h3 class="chapter-title">
                    <span class="chapter-number">#</span>
                    ${chapter.chapter_title}
                </h3>
            `;

            // Paragraphes
            chapter.paragraphs?.forEach((para: any) => {
                bodyContent += `<h4 class="paragraph-title">${para.para_name}</h4>`;

                // Notions
                para.notions?.forEach((notion: any) => {
                    if (notion.notion_name) {
                        bodyContent += `<h5 class="notion-header">${notion.notion_name}</h5>`;
                    }
                    bodyContent += `<div class="prose-content">${notion.notion_content}</div>`;
                });
            });
        });

        bodyContent += `</div>`;
    });

    return `<!DOCTYPE html><html><head><meta charset="UTF-8">${css}</head><body>${bodyContent}</body></html>`;
}

/**
 * Génère un document PDF à partir d'un projet en utilisant Puppeteer.
 * @param project - Projet avec toute sa structure.
 * @returns Stream du PDF généré.
 */
export async function generatePDF(project: ProjectForExport): Promise<PassThrough> {
    const htmlContent = generatePrintableHTML(project);
    const stream = new PassThrough();

    (async () => {
        let browser;
        try {
            console.log("🚀 Lancement de Puppeteer pour la génération PDF...");
            browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
            const page = await browser.newPage();

            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

            // Génère le PDF en se basant sur le rendu de la page
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '0', right: '0', bottom: '0', left: '0' },
                displayHeaderFooter: false,
            });

            console.log("✅ PDF généré avec succès via Puppeteer.");
            stream.end(pdfBuffer);

        } catch (error) {
            console.error("❌ Erreur lors de la génération PDF avec Puppeteer:", error);
            stream.emit('error', new Error('Erreur Puppeteer'));
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    })();

    return stream;
}
