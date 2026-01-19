import { Server } from '@hocuspocus/server';
import { TiptapTransformer } from '@hocuspocus/transformer';
import * as Y from 'yjs';
import prisma from './src/lib/prisma';
import 'dotenv/config';

console.log('[Synapse] Starting engine...');

const server = new Server({
    port: 1234,
    address: '0.0.0.0', // Listen on all interfaces

    async onAuthenticate(data) {
        // console.log('[Synapse] Authenticating user...');
        return {
            user: {
                id: '1',
                name: 'Collaborateur',
            },
        };
    },

    async onLoadDocument(data) {
        const { documentName } = data;
        console.log(`[Synapse] 📥 Loading document: ${documentName}`);

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
            }
        } catch (error) {
            console.error(`[Synapse] ❌ Error loading document ${documentName}:`, error);
        }

        return new Y.Doc();
    },

    async onStoreDocument(data) {
        const { documentName, document } = data;
        console.log(`[Synapse] 💾 Storing document: ${documentName}`);

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
            }
        } catch (error) {
            console.error(`[Synapse] ❌ Error storing document ${documentName}:`, error);
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
console.log('[Synapse] 🛰️ Collaboration server running on ws://192.168.1.160:1234');
