import prisma from '../lib/prisma';
import { Server } from '@hocuspocus/server';
console.log('Prisma is', !!prisma);
console.log('Server is', !!Server);
