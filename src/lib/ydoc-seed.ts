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

/** Convertit du HTML TipTap en buffer Y.Doc pour Synapse (création / seed initial uniquement) */
export function htmlToYdocBuffer(html: string | null | undefined): Buffer | null {
  if (!hasSubstantialHtml(html)) return null;
  try {
    const ydoc = TiptapTransformer.toYdoc(html!, 'prosemirror');
    return Buffer.from(Y.encodeStateAsUpdate(ydoc));
  } catch (error) {
    console.warn('[ydoc-seed] htmlToYdocBuffer failed:', error);
    return null;
  }
}

/** Charge un Y.Doc : buffer existant, sinon seed depuis HTML si le CRDT est vide */
export function loadYdocFromGranule(
  ydocBuffer: Buffer | null | undefined,
  html: string | null | undefined
): Y.Doc {
  if (ydocBuffer && ydocBuffer.length > 0) {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, ydocBuffer);
    if (!isYDocEmpty(doc) || !hasSubstantialHtml(html)) {
      return doc;
    }
  }

  if (hasSubstantialHtml(html)) {
    try {
      return TiptapTransformer.toYdoc(html!, 'prosemirror');
    } catch (error) {
      console.warn('[ydoc-seed] loadYdocFromGranule HTML fallback failed:', error);
    }
  }

  return new Y.Doc();
}
