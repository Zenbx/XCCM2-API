import { Server } from '@hocuspocus/server';
import { TiptapTransformer } from '@hocuspocus/transformer';
import * as Y from 'yjs';
import prisma from '../lib/prisma.js'; // This will fail if prima.ts is not compiled
import 'dotenv/config';

// But wait, prisma.ts is a TS file.
// If I use node directy, it won't work unless I use a loader.
