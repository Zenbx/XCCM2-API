import { Server } from '@hocuspocus/server';
import { TiptapTransformer } from '@hocuspocus/transformer';
import prisma from '../lib/prisma.js';
import 'dotenv/config';
import * as Y from 'yjs';
import { jwtVerify } from 'jose';

/**
 * Synapse Server - Hocuspocus implementation for real-time collaboration
 *
 * Supported document types:
 *   notion-{id}    → Notion content
 *   part-{id}      → Part intro
 *   chapter-{id}   → Chapter intro (future)
 *   paragraph-{id} → Paragraph intro (future)
 */
const PORT = process.env.PORT || process.env.SYNAPSE_PORT || 1234;

// Debounce map to avoid excessive DB writes
const storeTimers = new Map<string, NodeJS.Timeout>();
const STORE_DEBOUNCE_MS = 2000; // 2 seconds

const server = new Server({
    port: Number(PORT),
    address: '0.0.0.0',

    async onAuthenticate(data) {
        const { token } = data;

        // Si pas de token, rejeter la connexion
        if (!token) {
            console.warn('[Synapse] ❌ Connexion refusée: pas de token');
            throw new Error('Authentication requise');
        }

        try {
            // Vérifier le JWT
            const JWT_SECRET = process.env.JWT_SECRET;
            if (!JWT_SECRET) {
                console.error('[Synapse] ❌ JWT_SECRET non configuré');
                throw new Error('Configuration serveur invalide');
            }

            const secret = new TextEncoder().encode(JWT_SECRET);
            const { payload } = await jwtVerify(token, secret);

            const userId = payload.userId as string;
            const email = payload.email as string;

            if (!userId) {
                throw new Error('Token invalide: userId manquant');
            }

            // Récupérer les infos utilisateur depuis la DB pour avoir le nom complet
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
                });

                if (notion) {
                    return TiptapTransformer.toYdoc(notion.notion_content || '', 'prosemirror');
                }
            } else if (documentName.startsWith('part-')) {
                const partId = documentName.replace('part-', '');
                const part = await prisma.part.findUnique({
                    where: { part_id: partId },
                });

                if (part) {
                    return TiptapTransformer.toYdoc(part.part_intro || '', 'prosemirror');
                }
            } else if (documentName.startsWith('chapter-')) {
                const chapterId = documentName.replace('chapter-', '');
                const chapter = await prisma.chapter.findUnique({
                    where: { chapter_id: chapterId },
                });

                if (chapter) {
                    return TiptapTransformer.toYdoc((chapter as any).chapter_intro || '', 'prosemirror');
                }
            } else if (documentName.startsWith('paragraph-')) {
                const paragraphId = documentName.replace('paragraph-', '');
                const paragraph = await prisma.paragraph.findUnique({
                    where: { para_id: paragraphId },
                });

                if (paragraph) {
                    return TiptapTransformer.toYdoc((paragraph as any).para_intro || '', 'prosemirror');
                }
            }
        } catch (error) {
            console.error(`[Synapse] Error loading document ${documentName}:`, error);
        }

        return new Y.Doc();
    },

    async onStoreDocument(data) {
        const { documentName, document } = data;

        // Debounced store: avoid excessive DB writes during fast typing
        if (storeTimers.has(documentName)) {
            clearTimeout(storeTimers.get(documentName)!);
        }

        storeTimers.set(documentName, setTimeout(async () => {
            storeTimers.delete(documentName);

            console.log(`[Synapse] Storing document: ${documentName}`);

            try {
                const html = TiptapTransformer.fromYdoc(document, 'prosemirror');

                if (documentName.startsWith('notion-')) {
                    const notionId = documentName.replace('notion-', '');
                    await prisma.notion.update({
                        where: { notion_id: notionId },
                        data: { notion_content: html },
                    });
                } else if (documentName.startsWith('part-')) {
                    const partId = documentName.replace('part-', '');
                    await prisma.part.update({
                        where: { part_id: partId },
                        data: { part_intro: html },
                    });
                } else if (documentName.startsWith('chapter-')) {
                    const chapterId = documentName.replace('chapter-', '');
                    await prisma.chapter.update({
                        where: { chapter_id: chapterId },
                        data: { chapter_intro: html } as any,
                    });
                } else if (documentName.startsWith('paragraph-')) {
                    const paragraphId = documentName.replace('paragraph-', '');
                    await prisma.paragraph.update({
                        where: { para_id: paragraphId },
                        data: { para_intro: html } as any,
                    });
                }

                console.log(`[Synapse] ✅ Stored ${documentName}`);
            } catch (error) {
                console.error(`[Synapse] Error storing document ${documentName}:`, error);
            }
        }, STORE_DEBOUNCE_MS));
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
