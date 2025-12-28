import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const deleted = await prisma.paragraph.deleteMany({});
    console.log(`${deleted.count} paragraphes supprimées.`);
}

main();