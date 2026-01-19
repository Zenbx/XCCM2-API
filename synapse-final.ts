import { Server } from '@hocuspocus/server';
import { TiptapTransformer } from '@hocuspocus/transformer';
import * as Y from 'yjs';
import prisma from './src/lib/prisma';
import 'dotenv/config';

console.log('[Synapse] 🛰️ Initializing Server...');

const server = new Server({
    port: 1234,
    address: '0.0.0.0', // IMPORTANT: Accessible on local network

    async onAuthenticate() {
        return { user: { id: 'admin', name: 'Collaborateur' } };
    },

    async onLoadDocument({ documentName }) {
        console.log(`[Synapse] 📥 Loading: ${documentName}`);
        try {
            if (documentName.startsWith('notion-')) {
                const notionId = documentName.replace('notion-', '');
                const notion = await prisma.notion.findUnique({ where: { notion_id: notionId } });
                if (notion) return TiptapTransformer.toYdoc(notion.notion_content || '', 'prosemirror');
            } else if (documentName.startsWith('part-')) {
                const partId = documentName.replace('part-', '');
                const part = await prisma.part.findUnique({ where: { part_id: partId } });
                if (part) return TiptapTransformer.toYdoc(part.part_intro || '', 'prosemirror');
            }
        } catch (e) {
            console.error('[Synapse] ❌ Load Error:', e.message);
        }
        return new Y.Doc();
    },

    async onStoreDocument({ documentName, document }) {
        console.log(`[Synapse] 💾 Storing: ${documentName}`);
        try {
            const html = TiptapTransformer.fromYdoc(document, 'prosemirror');
            if (documentName.startsWith('notion-')) {
                const notionId = documentName.replace('notion-', '');
                await prisma.notion.update({ where: { notion_id: notionId }, data: { notion_content: html } });
            } else if (documentName.startsWith('part-')) {
                const partId = documentName.replace('part-', '');
                await prisma.part.update({ where: { part_id: partId }, data: { part_intro: html } });
            }
        } catch (e) {
            console.error('[Synapse] ❌ Store Error:', e.message);
        }
    },

    async onConnect() { console.log('[Synapse] 🚀 Connect'); },
});

server.listen();
console.log('[Synapse] 📡 Collaboration active on ws://192.168.1.160:1234');
