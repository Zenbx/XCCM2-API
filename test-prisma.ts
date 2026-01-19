import prisma from './src/lib/prisma';
async function test() {
    console.log('Prisma Client imported:', !!prisma);
    try {
        const count = await prisma.user.count();
        console.log('User count:', count);
    } catch (e) {
        console.error('Prisma Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}
test();
