import { Server } from '@hocuspocus/server';
import { TiptapTransformer } from '@hocuspocus/transformer';
import * as Y from 'yjs';
import 'dotenv/config';

console.log('[Synapse] Starting engine (sy-no-prisma.ts)...');

const server = new Server({
    port: 1234,
    address: '0.0.0.0',

    async onAuthenticate(data) {
        return { user: { id: '1', name: 'Collaborateur' } };
    },

    async onLoadDocument(data) {
        console.log(`[Synapse] Loading (Dry Run)`);
        return new Y.Doc();
    },

    async onConnect() { console.log('[Synapse] 🚀 Connect'); },
});

server.listen();
console.log('[Synapse] 🛰️ Running on ws://192.168.1.160:1234');
