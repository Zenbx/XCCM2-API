import { Server } from '@hocuspocus/server';
import prisma from '../lib/prisma.js';
import 'dotenv/config';
import * as Y from 'yjs';
import { jwtVerify } from 'jose';
import {
    loadYdocFromGranule,
    ydocToHtml,
    isYDocEffectivelyEmpty,
    hasSubstantialHtml,
} from '../lib/ydoc-seed.js';

/**
 * Synapse Server - Hocuspocus implementation for real-time collaboration
 *
 * Supported document types:
 *   notion-{id}    → Notion content
 *   part-{id}      → Part intro
 *   chapter-{id}   → Chapter intro
 *   paragraph-{id} → Paragraph intro
 *
 * Storage: binary Y.Doc state (Y.encodeStateAsUpdate / Y.applyUpdate)
 * + HTML miroir (notion_content / part_intro / …) pour que la Mind Map
 * et le rechargement après déconnexion restent cohérents.
 */
const PORT = process.env.PORT || process.env.SYNAPSE_PORT || 1234;

// Startup env check
console.log('[Synapse] ENV check:', {
    JWT_SECRET: process.env.JWT_SECRET ? `SET (${process.env.JWT_SECRET.length} chars)` : 'MISSING',
    DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'MISSING',
    NODE_ENV: process.env.NODE_ENV ?? 'undefined',
    PORT: process.env.PORT ?? 'undefined (using fallback)',
});

const server = new Server({
    port: Number(PORT),
    address: '0.0.0.0',

    // Debounce géré par Hocuspocus (on attend la fin du store avant unload)
    debounce: 2000,
    maxDebounce: 10000,

    async onAuthenticate(data) {
        const { token } = data;

        if (!token) {
            console.warn('[Synapse] ❌ Connexion refusée: pas de token');
            throw new Error('Authentication requise');
        }

        try {
            const JWT_SECRET = process.env.JWT_SECRET;
            if (!JWT_SECRET) {
                console.error('[Synapse] ❌ JWT_SECRET non configuré');
                throw new Error('Configuration serveur invalide');
            }

            const secret = new TextEncoder().encode(JWT_SECRET);
            const { payload } = await jwtVerify(token, secret);

            const userId = payload.userId as string;

            if (!userId) {
                throw new Error('Token invalide: userId manquant');
            }

            const user = await prisma.user.findUnique({
                where: { user_id: userId },
                select: {
                    user_id: true,
                    firstname: true,
                    lastname: true,
                    email: true,
                },
            });

            if (!user) {
                console.warn(`[Synapse] ❌ Utilisateur ${userId} non trouvé`);
                throw new Error('Utilisateur non trouvé');
            }

            console.log(`[Synapse] ✅ Authentification réussie: ${user.firstname} ${user.lastname}`);

            return {
                user: {
                    id: user.user_id,
                    name: `${user.firstname} ${user.lastname}`,
                    email: user.email,
                },
            };
        } catch (error) {
            console.error('[Synapse] ❌ Erreur d\'authentification:', error);
            throw new Error('Authentication échouée');
        }
    },

    async onLoadDocument(data) {
        const { documentName } = data;
        console.log(`[Synapse] Loading document: ${documentName}`);

        try {
            if (documentName.startsWith('notion-')) {
                const notionId = documentName.replace('notion-', '');
                const notion = await prisma.notion.findUnique({
                    where: { notion_id: notionId },
                    select: { notion_ydoc: true, notion_content: true },
                });
                return loadYdocFromGranule(
                    notion?.notion_ydoc as Buffer | null,
                    notion?.notion_content
                );

            } else if (documentName.startsWith('part-')) {
                const partId = documentName.replace('part-', '');
                const part = await prisma.part.findUnique({
                    where: { part_id: partId },
                    select: { part_ydoc: true, part_intro: true },
                });
                return loadYdocFromGranule(
                    (part as { part_ydoc?: Buffer | null })?.part_ydoc as Buffer | null,
                    part?.part_intro
                );

            } else if (documentName.startsWith('chapter-')) {
                const chapterId = documentName.replace('chapter-', '');
                const chapter = await prisma.chapter.findUnique({
                    where: { chapter_id: chapterId },
                    select: { chapter_ydoc: true, chapter_intro: true } as { chapter_ydoc: true; chapter_intro: true },
                });
                return loadYdocFromGranule(
                    (chapter as { chapter_ydoc?: Buffer | null })?.chapter_ydoc as Buffer | null,
                    (chapter as { chapter_intro?: string | null })?.chapter_intro
                );

            } else if (documentName.startsWith('paragraph-')) {
                const paragraphId = documentName.replace('paragraph-', '');
                const paragraph = await prisma.paragraph.findUnique({
                    where: { para_id: paragraphId },
                    select: { para_ydoc: true, para_intro: true } as { para_ydoc: true; para_intro: true },
                });
                return loadYdocFromGranule(
                    (paragraph as { para_ydoc?: Buffer | null })?.para_ydoc as Buffer | null,
                    (paragraph as { para_intro?: string | null })?.para_intro
                );
            }
        } catch (error) {
            console.error(`[Synapse] Error loading document ${documentName}:`, error);
        }

        return new Y.Doc();
    },

    async onStoreDocument(data) {
        const { documentName, document } = data;
        console.log(`[Synapse] Storing document: ${documentName}`);

        try {
            const ydocBinary = Buffer.from(Y.encodeStateAsUpdate(document));
            // Miroir HTML : même source que la Mind Map / auto-save REST
            const html = ydocToHtml(document);
            const ydocEmpty = isYDocEffectivelyEmpty(document);

            if (documentName.startsWith('notion-')) {
                const notionId = documentName.replace('notion-', '');
                // Ne pas écraser un HTML/restore substantiel avec un CRDT vide
                // (race déconnexion après restore, ou éditeur monté avant sync).
                if (ydocEmpty) {
                    const existing = await prisma.notion.findUnique({
                        where: { notion_id: notionId },
                        select: { notion_content: true },
                    });
                    if (hasSubstantialHtml(existing?.notion_content)) {
                        console.log(`[Synapse] Skip empty ydoc over substantial HTML: ${documentName}`);
                        return;
                    }
                }
                await prisma.notion.update({
                    where: { notion_id: notionId },
                    data: {
                        notion_ydoc: ydocBinary,
                        ...(html != null ? { notion_content: html } : {}),
                    } as any,
                });
            } else if (documentName.startsWith('part-')) {
                const partId = documentName.replace('part-', '');
                if (ydocEmpty) {
                    const existing = await prisma.part.findUnique({
                        where: { part_id: partId },
                        select: { part_intro: true },
                    });
                    if (hasSubstantialHtml(existing?.part_intro)) {
                        console.log(`[Synapse] Skip empty ydoc over substantial HTML: ${documentName}`);
                        return;
                    }
                }
                await prisma.part.update({
                    where: { part_id: partId },
                    data: {
                        part_ydoc: ydocBinary,
                        ...(html != null ? { part_intro: html } : {}),
                    } as any,
                });
            } else if (documentName.startsWith('chapter-')) {
                const chapterId = documentName.replace('chapter-', '');
                await prisma.chapter.update({
                    where: { chapter_id: chapterId },
                    data: {
                        chapter_ydoc: ydocBinary,
                        ...(html != null ? { chapter_intro: html } : {}),
                    } as any,
                });
            } else if (documentName.startsWith('paragraph-')) {
                const paragraphId = documentName.replace('paragraph-', '');
                await prisma.paragraph.update({
                    where: { para_id: paragraphId },
                    data: {
                        para_ydoc: ydocBinary,
                        ...(html != null ? { para_intro: html } : {}),
                    } as any,
                });
            }

            console.log(`[Synapse] ✅ Stored ${documentName}`);
        } catch (error) {
            console.error(`[Synapse] Error storing document ${documentName}:`, error);
            throw error;
        }
    },

    async onConnect() {
        console.log('[Synapse] 🚀 New connection established');
    },

    async onDisconnect() {
        console.log('[Synapse] 👋 Connection closed');
    },
});

server.listen();
console.log(`[Synapse] 🛰️ Collaboration server running on ws://0.0.0.0:${PORT}`);
