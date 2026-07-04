/**
 * Polices Poppins embarquées (base64) pour export PDF offline.
 * Fichiers source : node_modules/@fontsource/poppins/files/
 */

import { readFileSync } from "fs";
import { join } from "path";

const FONTS_DIR = join(process.cwd(), "node_modules/@fontsource/poppins/files");

function embedWoff2(weight: number, filename: string): string {
  try {
    const data = readFileSync(join(FONTS_DIR, filename)).toString("base64");
    return `@font-face{font-family:'Poppins';font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${data}) format('woff2');}`;
  } catch {
    return "";
  }
}

/** CSS @font-face Poppins latin (400–700) pour Puppeteer sans accès Internet */
export function getEmbeddedPoppinsCss(): string {
  return [
    embedWoff2(400, "poppins-latin-400-normal.woff2"),
    embedWoff2(500, "poppins-latin-500-normal.woff2"),
    embedWoff2(600, "poppins-latin-600-normal.woff2"),
    embedWoff2(700, "poppins-latin-700-normal.woff2"),
  ]
    .filter(Boolean)
    .join("\n");
}
