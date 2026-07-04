import { TiptapTransformer } from '@hocuspocus/transformer';
import * as Y from 'yjs';

export function hasSubstantialHtml(html: string | null | undefined): boolean {
  if (!html) return false;
  const stripped = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (stripped.length < 10) return false;
  const lower = stripped.toLowerCase();
  if (lower.includes('contenu à compléter') || lower.includes('contenu a completer')) return false;
  return true;
}

export function isEmptyEditorHtml(html: string | null | undefined): boolean {
  if (!html) return true;
  const stripped = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (stripped.length === 0) return true;
  const lower = stripped.toLowerCase();
  return lower.includes('contenu à compléter') || lower.includes('contenu a completer');
}

export function isYdocBufferEmpty(buf: Buffer | Uint8Array | null | undefined): boolean {
  return !buf || buf.length === 0;
}

export function isYDocEmpty(doc: Y.Doc): boolean {
  try {
    const fragment = doc.getXmlFragment('prosemirror');
    return fragment.length === 0;
  } catch {
    return doc.share.size === 0;
  }
}

/** Normalise les Bytes Prisma/Mongo (Buffer, Uint8Array, { type, data }, base64). */
export function toUint8Array(buf: unknown): Uint8Array | null {
  if (!buf) return null;
  if (buf instanceof Uint8Array) return buf.length > 0 ? buf : null;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(buf)) {
    return buf.length > 0 ? new Uint8Array(buf) : null;
  }
  if (typeof buf === 'object' && buf !== null && Array.isArray((buf as { data?: unknown }).data)) {
    const data = (buf as { data: number[] }).data;
    return data.length > 0 ? new Uint8Array(data) : null;
  }
  if (typeof buf === 'string' && buf.length > 0) {
    try {
      const decoded = Buffer.from(buf, 'base64');
      return decoded.length > 0 ? new Uint8Array(decoded) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function textLength(html: string | null | undefined): number {
  if (!html) return 0;
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length;
}

/** HTML extrait d'un Y.Doc (texte de base ; les NodeViews custom peuvent être simplifiés). */
export function ydocToHtml(doc: Y.Doc): string | null {
  try {
    const html = TiptapTransformer.fromYdoc(doc, 'prosemirror');
    return typeof html === 'string' ? html : null;
  } catch (error) {
    console.warn('[ydoc-seed] ydocToHtml failed:', error);
    return null;
  }
}

/** True si le CRDT n'a pas de texte utile (ex. seul un <p></p> vide stocké). */
export function isYDocEffectivelyEmpty(doc: Y.Doc): boolean {
  if (isYDocEmpty(doc)) return true;
  const html = ydocToHtml(doc);
  return isEmptyEditorHtml(html);
}

/** Convertit du HTML TipTap en buffer Y.Doc (seed initial, restore, sync forcée). */
export function htmlToYdocBuffer(html: string | null | undefined): Buffer | null {
  if (html == null) return null;
  try {
    const ydoc = TiptapTransformer.toYdoc(html.length > 0 ? html : '<p></p>', 'prosemirror');
    return Buffer.from(Y.encodeStateAsUpdate(ydoc));
  } catch (error) {
    console.warn('[ydoc-seed] htmlToYdocBuffer failed:', error);
    return null;
  }
}

/**
 * Charge un Y.Doc pour la collab.
 * Priorité au HTML (Mind Map / agent) si le CRDT est vide ou nettement plus pauvre.
 */
export function loadYdocFromGranule(
  ydocBuffer: Buffer | Uint8Array | null | undefined | unknown,
  html: string | null | undefined
): Y.Doc {
  const bytes = toUint8Array(ydocBuffer);

  if (bytes) {
    const doc = new Y.Doc();
    try {
      Y.applyUpdate(doc, bytes);
    } catch (error) {
      console.warn('[ydoc-seed] applyUpdate failed, falling back to HTML:', error);
      doc.destroy();
      return seedFromHtml(html);
    }

    const ydocHtml = ydocToHtml(doc);
    const htmlRicher =
      hasSubstantialHtml(html) &&
      (isEmptyEditorHtml(ydocHtml) || textLength(html) > textLength(ydocHtml) + 20);

    if (htmlRicher) {
      console.log('[ydoc-seed] reseeding from HTML (ydoc empty or poorer than notion_content)');
      doc.destroy();
      return seedFromHtml(html);
    }

    if (!isYDocEffectivelyEmpty(doc)) {
      return doc;
    }

    return doc;
  }

  return seedFromHtml(html);
}

function seedFromHtml(html: string | null | undefined): Y.Doc {
  if (html != null && html.length > 0) {
    try {
      return TiptapTransformer.toYdoc(html, 'prosemirror');
    } catch (error) {
      console.warn('[ydoc-seed] seedFromHtml failed:', error);
    }
  }
  return new Y.Doc();
}
