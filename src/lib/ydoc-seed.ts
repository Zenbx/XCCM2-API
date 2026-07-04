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
 * Si le buffer CRDT est absent / vide / sans texte utile, on reseed depuis le HTML
 * (celui que la Mind Map affiche correctement).
 */
export function loadYdocFromGranule(
  ydocBuffer: Buffer | null | undefined,
  html: string | null | undefined
): Y.Doc {
  if (ydocBuffer && ydocBuffer.length > 0) {
    const doc = new Y.Doc();
    try {
      Y.applyUpdate(doc, ydocBuffer);
    } catch (error) {
      console.warn('[ydoc-seed] applyUpdate failed, falling back to HTML:', error);
      doc.destroy();
      return seedFromHtml(html);
    }

    // CRDT non vide en structure mais sans texte → préférer le HTML (cas typique
    // après déconnexion avant le store Synapse, ou ydoc "fantôme" <p></p>).
    if (!isYDocEffectivelyEmpty(doc)) {
      return doc;
    }

    if (hasSubstantialHtml(html)) {
      console.log('[ydoc-seed] ydoc effectively empty, reseeding from HTML');
      doc.destroy();
      return seedFromHtml(html);
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
