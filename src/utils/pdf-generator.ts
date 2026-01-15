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
        if (!config) return '';
        let css = '';
        if (config.fontFamily) css += `font-family: "${config.fontFamily}", sans-serif !important; `;
        if (config.fontSize) css += `font-size: ${config.fontSize}px !important; `;
        if (config.color) css += `color: ${config.color} !important; `;
        if (config.fontWeight) css += `font-weight: ${config.fontWeight} !important; `;
        if (config.fontStyle) css += `font-style: ${config.fontStyle} !important; `;
        return css;
    };

    const css = `
        <style>
            @media print {
                @page {
                    margin: 0;
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
                font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                background-color: #ffffff;
                color: rgb(17, 24, 39);
                line-height: 1.5;
            }
            .page {
                padding: 2.5cm;
                min-height: 297mm;
                position: relative;
                page-break-after: always;
                background: white;
            }
            .title-page {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
            }
            .title-bar {
                width: 96px;
                height: 4px;
                background-color: rgb(153, 51, 76);
                margin-bottom: 32px;
            }
            h1 {
                font-size: 48px;
                font-weight: 700;
                color: rgb(17, 24, 39);
                margin-bottom: 24px;
                letter-spacing: -0.025em;
            }
            .subtitle {
                font-size: 20px;
                color: rgb(107, 114, 128);
                text-transform: uppercase;
                letter-spacing: 0.1em;
                font-weight: 300;
            }
            .title-footer {
                margin-top: 80px;
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            .icon-circle {
                width: 48px;
                height: 48px;
                border-radius: 50%;
                background-color: rgb(153, 51, 76);
                display: flex;
                align-items: center;
                justify-content: center;
                color: rgb(255, 255, 255);
                margin-bottom: 16px;
                font-size: 24px;
            }
            .footer-text, .footer-date {
                color: rgb(156, 163, 175);
                font-size: 14px;
            }
            .part-header {
                margin-bottom: 48px;
                border-bottom: 1px solid rgb(243, 244, 246);
                padding-bottom: 24px;
            }
            .part-label {
                color: rgb(153, 51, 76);
                background-color: rgba(153, 51, 76, 0.1);
                padding: 4px 12px;
                border-radius: 9999px;
                font-weight: 700;
                font-size: 14px;
                display: inline-block;
                margin-bottom: 16px;
            }
            h2 {
                font-size: 36px;
                font-weight: 700;
                color: rgb(17, 24, 39);
                margin-top: 8px;
                ${getCssFromStyleConfig(styles?.part?.title)}
            }
            .part-intro {
                margin-bottom: 48px;
                font-size: 18px;
                color: rgb(75, 85, 99);
                line-height: 1.8;
                font-style: italic;
                border-left: 4px solid rgba(153, 51, 76, 0.2);
                padding-left: 24px;
                ${getCssFromStyleConfig(styles?.part?.intro)}
            }
            h3 {
                font-size: 30px;
                font-weight: 700;
                color: rgb(17, 24, 39);
                margin-bottom: 32px;
                margin-top: 48px;
                display: flex;
                align-items: center;
                gap: 12px;
                ${getCssFromStyleConfig(styles?.chapter?.title)}
            }
            .chapter-number {
                color: rgb(153, 51, 76);
                opacity: 0.5;
                font-weight: 400;
            }
            h4 {
                font-size: 24px;
                font-weight: 700;
                color: rgb(31, 41, 55);
                margin-bottom: 24px;
            }
            h5 {
                font-size: 14px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: rgb(107, 114, 128);
                font-weight: 700;
                margin-bottom: 12px;
                border-bottom: 1px solid rgb(243, 244, 246);
                display: inline-block;
                padding-bottom: 4px;
            }
            .notion-content {
                font-size: 18px;
                line-height: 1.8;
                color: rgb(55, 65, 81);
                margin-bottom: 32px;
            }
            .notion-content p { margin-bottom: 16px; }
            .notion-content ul, .notion-content ol { margin-left: 24px; margin-bottom: 16px; }
            .notion-content li { margin-bottom: 8px; }
            .notion-content blockquote { border-left: 4px solid #eee; padding-left: 16px; font-style: italic; color: #666; }
            
            .toc-page { padding: 2.5cm; }
            .toc-title { font-size: 28px; font-weight: 700; color: rgb(153, 51, 76); margin-bottom: 32px; border-bottom: 2px solid rgba(153, 51, 76, 0.1); padding-bottom: 16px; }
            .toc-item-part { font-size: 18px; font-weight: 700; margin-top: 24px; color: rgb(17, 24, 39); }
            .toc-item-chapter { font-size: 16px; margin-left: 24px; margin-top: 8px; color: rgb(75, 85, 99); }
        </style>
    `;

    let bodyContent = '';

    // Page de titre
    bodyContent += `
        <div class="page title-page">
            <div class="title-bar"></div>
            <h1>${pr_name.toUpperCase()}</h1>
            <p class="subtitle">Document de Composition</p>
            <div class="title-footer">
                <div class="icon-circle">📄</div>
                <p class="footer-text">Généré par XCCM 2</p>
                <p class="footer-date">${new Date().toLocaleDateString('fr-FR')}</p>
            </div>
        </div>
    `;

    // Table des matières
    if (parts.length > 0) {
        bodyContent += `
            <div class="page toc-page text-gray-900">
                <h2 class="toc-title">Table des Matières</h2>
                <div>
                    ${parts.map((part, pIdx) => `
                        <div class="toc-item-part">
                            Partie ${pIdx + 1}: ${part.part_title}
                        </div>
                        ${part.chapters?.map((chap) => `
                            <div class="toc-item-chapter">
                                ${chap.chapter_title}
                            </div>
                        `).join('') || ''}
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Contenu
    parts.forEach((part, partIndex) => {
        bodyContent += `<div class="page">`;
        bodyContent += `
            <div class="part-header">
                <span class="part-label">Partie ${part.part_number}</span>
                <h2>${part.part_title}</h2>
            </div>
        `;
        if (part.part_intro) {
            bodyContent += `<div class="part-intro">${part.part_intro}</div>`;
        }
        part.chapters?.forEach((chapter) => {
            bodyContent += `<h3><span class="chapter-number">#</span>${chapter.chapter_title}</h3>`;
            chapter.paragraphs?.forEach((para: any) => {
                bodyContent += `<h4>${para.para_name}</h4>`;
                para.notions?.forEach((notion: any) => {
                    if (notion.notion_name) bodyContent += `<h5>${notion.notion_name}</h5>`;
                    bodyContent += `<div class="notion-content">${notion.notion_content}</div>`;
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
