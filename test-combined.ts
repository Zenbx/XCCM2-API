import { Server } from '@hocuspocus/server';
import { TiptapTransformer } from '@hocuspocus/transformer';
import * as Y from 'yjs';
import prisma from './src/lib/prisma';
import 'dotenv/config';

console.log('[Synapse] Starting engine (test-combined.ts)...');

const server = new Server({
    port: 1234,
    address: '0.0.0.0',

    async onAuthenticate(data) {
        return { user: { id: '1', name: 'Collaborateur' } };
    },

    async onLoadDocument(data) {
        const { documentName } = data;
        console.log(`[Synapse] 📥 Loading: ${documentName}`);

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
            console.error(`[Synapse] ❌ Load Error:`, error);
        }

        return new Y.Doc();
    },

    async onStoreDocument(data) {
        const { documentName, document } = data;
        console.log(`[Synapse] 💾 Storing: ${documentName}`);

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
            console.error(`[Synapse] ❌ Store Error:`, error);
        }
    },

    async onConnect() { console.log('[Synapse] 🚀 Connect'); },
});

server.listen();
console.log('[Synapse] 🛰️ Running on ws://192.168.1.160:1234');
