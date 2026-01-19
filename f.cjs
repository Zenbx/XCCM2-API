const { Server } = require('@hocuspocus/server');
const { TiptapTransformer } = require('@hocuspocus/transformer');
const Y = require('yjs');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

console.log('[Synapse] 🚀 Starting Engine (f.cjs)...');

const prisma = new PrismaClient();

const server = new Server({
    port: 1234,
    address: '0.0.0.0',

    async onAuthenticate() {
        return { user: { id: 'admin', name: 'Collaborateur' } };
    },

    async onLoadDocument(data) {
        const documentName = data.documentName;
        console.log(`[Synapse] 📥 Loading: ${documentName}`);
        try {
            if (documentName.startsWith('notion-')) {
                const id = documentName.replace('notion-', '');
                const notion = await prisma.notion.findUnique({ where: { notion_id: id } });
                if (notion) return TiptapTransformer.toYdoc(notion.notion_content || '', 'prosemirror');
            } else if (documentName.startsWith('part-')) {
                const id = documentName.replace('part-', '');
                const part = await prisma.part.findUnique({ where: { part_id: id } });
                if (part) return TiptapTransformer.toYdoc(part.part_intro || '', 'prosemirror');
            }
        } catch (e) {
            console.error('[Synapse] ❌ Load Error');
        }
        return new Y.Doc();
    },

    async onStoreDocument(data) {
        const documentName = data.documentName;
        const document = data.document;
        console.log(`[Synapse] 💾 Storing: ${documentName}`);
        try {
            const html = TiptapTransformer.fromYdoc(document, 'prosemirror');
            if (documentName.startsWith('notion-')) {
                const id = documentName.replace('notion-', '');
                await prisma.notion.update({ where: { notion_id: id }, data: { notion_content: html } });
            } else if (documentName.startsWith('part-')) {
                const id = documentName.replace('part-', '');
                await prisma.part.update({ where: { part_id: id }, data: { part_intro: html } });
            }
        } catch (e) {
            console.error('[Synapse] ❌ Store Error');
        }
    },
});

server.listen();
console.log('[Synapse] 📡 Active on ws://192.168.1.160:1234');
