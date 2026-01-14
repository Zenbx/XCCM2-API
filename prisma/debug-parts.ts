
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const projectName = 'Jeff';
    console.log(`Searching for project: ${projectName}`);

    const project = await prisma.project.findFirst({
        where: { pr_name: projectName }
    });

    if (!project) {
        console.error('Project not found');
        return;
    }

    console.log(`Project ID: ${project.pr_id}`);

    const parts = await prisma.part.findMany({
        where: { parent_pr: project.pr_id },
        orderBy: { part_number: 'asc' }
    });

    console.log('Parts found:');
    parts.forEach(p => {
        console.log(`- ID: ${p.part_id}, Title: "${p.part_title}", Number: ${p.part_number}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
