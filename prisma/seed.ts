/*import { PrismaClient, InvitationState } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Début du seeding ---');

    // 1. Nettoyage de la base de données (Optionnel mais recommandé)
    // L'ordre est important à cause des relations
    await prisma.like.deleteMany();
    await prisma.invitation.deleteMany();
    await prisma.notion.deleteMany();
    await prisma.paragraph.deleteMany();
    await prisma.chapter.deleteMany();
    await prisma.part.deleteMany();
    await prisma.document.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();

    // 2. Création des Utilisateurs
    const users = await Promise.all(
        Array.from({ length: 5 }).map(() =>
            prisma.user.create({
                data: {
                    email: faker.internet.email(),
                    lastname: faker.person.lastName(),
                    firstname: faker.person.firstName(),
                    password: 'password123', // En prod, utilisez bcrypt
                    org: faker.company.name(),
                    occupation: faker.person.jobTitle(),
                },
            })
        )
    );
    const mainUser = users[0];
    const secondUser = users[1];
    console.log(`✅ ${users.length} utilisateurs créés`);

    // 3. Création d'un Projet pour l'utilisateur principal
    const project = await prisma.project.create({
        data: {
            pr_name: "Guide de Développement Durable",
            owner_id: mainUser.user_id,
        },
    });
    console.log(`✅ Projet "${project.pr_name}" créé`);

    // 4. Création des Documents pour ce projet
    await prisma.document.createMany({
        data: [
            {
                doc_name: "Rapport_Annuel_2024.pdf",
                pages: 45,
                doc_size: 2048,
                url_content: "https://storage.cloud.com/pdf/1",
                pr_source: project.pr_id,
            },
            {
                doc_name: "Cahier_des_charges.docx",
                pages: 12,
                doc_size: 512,
                url_content: "https://storage.cloud.com/docx/2",
                pr_source: project.pr_id,
            }
        ],
    });

    // 5. Structure hiérarchique : Part -> Chapter -> Paragraph -> Notion
    for (let i = 1; i <= 2; i++) {
        const part = await prisma.part.create({
            data: {
                part_title: `Partie ${i}: ${faker.lorem.words(3)}`,
                part_intro: faker.lorem.sentence(),
                part_number: i,
                parent_pr: project.pr_id,
            },
        });

        for (let j = 1; j <= 2; j++) {
            const chapter = await prisma.chapter.create({
                data: {
                    chapter_title: `Chapitre ${i}.${j}`,
                    chapter_number: j,
                    parent_part: part.part_id,
                },
            });

            for (let k = 1; k <= 2; k++) {
                const paragraph = await prisma.paragraph.create({
                    data: {
                        para_name: `Paragraphe ${i}.${j}.${k}`,
                        para_number: k.toString(),
                        parent_chapter: chapter.chapter_id,
                    },
                });

                await prisma.notion.create({
                    data: {
                        notion_name: faker.lorem.word(),
                        notion_content: faker.lorem.paragraph(),
                        parent_para: paragraph.para_id,
                    },
                });
            }
        }
    }
    console.log('✅ Structure (Parties/Chapitres/Paras/Notions) générée');

    // 6. Invitations
    await prisma.invitation.create({
        data: {
            pr_id: project.pr_id,
            host_id: mainUser.user_id,
            guest_id: secondUser.user_id,
            invitation_state: InvitationState.Pending,
        },
    });

    // 7. Likes
    const doc = await prisma.document.findFirst({ where: { pr_source: project.pr_id } });
    if (doc) {
        await prisma.like.create({
            data: {
                liker_id: secondUser.user_id,
                doc_id: doc.doc_id,
            },
        });
    }

    console.log('--- Seeding terminé avec succès ---');
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });

 */