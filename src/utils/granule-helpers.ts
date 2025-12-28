/**
 * @fileoverview Fonctions utilitaires pour la gestion des granules
 * Gère la renumérotation automatique lors de la modification et suppression
 *
 * RÈGLES DE RENUMÉROTATION :
 * - À la création : Le numéro ne doit pas exister (vérification dans les routes)
 * - À la modification : Le nouveau numéro doit exister pour déclencher un décalage
 * - À la suppression : Tous les numéros supérieurs sont décrémentés
 */

import prisma from "@/lib/prisma";

// ==========================================
// FONCTIONS POUR LES PARTS (PARTIES)
// ==========================================

/**
 * Renumérotation des parties après suppression
 * Décrémente tous les numéros > au numéro supprimé
 * @param parentProjectId - ID du projet parent
 * @param deletedNumber - Numéro de la partie supprimée
 */
export async function renumberPartsAfterDelete(
    parentProjectId: string,
    deletedNumber: number
): Promise<void> {
    const partsToUpdate = await prisma.part.findMany({
        where: {
            parent_pr: parentProjectId,
            part_number: {
                gt: deletedNumber,
            },
        },
        orderBy: {
            part_number: "asc",
        },
    });

    for (const part of partsToUpdate) {
        await prisma.part.update({
            where: {
                part_id: part.part_id,
            },
            data: {
                part_number: part.part_number - 1,
            },
        });
    }
}

/**
 * Renumérotation des parties lors d'un changement de numéro
 * Le nouveau numéro DOIT exister pour déclencher le décalage
 *
 * Logique :
 * - Si newNumber > oldNumber : Décrémente les parties entre oldNumber et newNumber
 * - Si newNumber < oldNumber : Incrémente les parties entre newNumber et oldNumber
 *
 * Exemple 1 : Parties [1, 2, 3, 4], changer 1 → 3
 *   - Décrémente 2→1, 3→2
 *   - Résultat : [2, 3, 1, 4] puis on met 1→3 = [2, 1, 3, 4]
 *
 * Exemple 2 : Parties [1, 2, 3, 4], changer 4 → 2
 *   - Incrémente 2→3, 3→4
 *   - Résultat : [1, 3, 4, 2] puis on met 2→2 = [1, 4, 2, 3]
 *
 * @param parentProjectId - ID du projet parent
 * @param oldNumber - Ancien numéro de la partie
 * @param newNumber - Nouveau numéro (doit exister)
 * @param excludePartId - ID de la partie à modifier (à exclure du décalage)
 */
export async function renumberPartsAfterUpdate(
    parentProjectId: string,
    oldNumber: number,
    newNumber: number,
    excludePartId: string
): Promise<void> {
    if (oldNumber === newNumber) return;

    if (oldNumber < newNumber) {
        // Cas 1 : Déplacement vers le haut (ex: 1 → 3)
        // On décrémente toutes les parties entre oldNumber+1 et newNumber
        const partsToUpdate = await prisma.part.findMany({
            where: {
                parent_pr: parentProjectId,
                part_number: {
                    gt: oldNumber,
                    lte: newNumber,
                },
                part_id: {
                    not: excludePartId,
                },
            },
            orderBy: {
                part_number: "asc", // Ordre croissant pour éviter les conflits
            },
        });

        for (const part of partsToUpdate) {
            await prisma.part.update({
                where: {
                    part_id: part.part_id,
                },
                data: {
                    part_number: part.part_number - 1,
                },
            });
        }
    } else {
        // Cas 2 : Déplacement vers le bas (ex: 4 → 2)
        // On incrémente toutes les parties entre newNumber et oldNumber-1
        const partsToUpdate = await prisma.part.findMany({
            where: {
                parent_pr: parentProjectId,
                part_number: {
                    gte: newNumber,
                    lt: oldNumber,
                },
                part_id: {
                    not: excludePartId,
                },
            },
            orderBy: {
                part_number: "desc", // Ordre décroissant pour éviter les conflits
            },
        });

        for (const part of partsToUpdate) {
            await prisma.part.update({
                where: {
                    part_id: part.part_id,
                },
                data: {
                    part_number: part.part_number + 1,
                },
            });
        }
    }
}

// ==========================================
// FONCTIONS POUR LES CHAPTERS (CHAPITRES)
// ==========================================

/**
 * Renumérotation des chapitres après suppression
 * Décrémente tous les numéros > au numéro supprimé
 * @param parentPartId - ID de la partie parente
 * @param deletedNumber - Numéro du chapitre supprimé
 */
export async function renumberChaptersAfterDelete(
    parentPartId: string,
    deletedNumber: number
): Promise<void> {
    const chaptersToUpdate = await prisma.chapter.findMany({
        where: {
            parent_part: parentPartId,
            chapter_number: {
                gt: deletedNumber,
            },
        },
        orderBy: {
            chapter_number: "asc",
        },
    });

    for (const chapter of chaptersToUpdate) {
        await prisma.chapter.update({
            where: {
                chapter_id: chapter.chapter_id,
            },
            data: {
                chapter_number: chapter.chapter_number - 1,
            },
        });
    }
}

/**
 * Renumérotation des chapitres lors d'un changement de numéro
 * Le nouveau numéro DOIT exister pour déclencher le décalage
 *
 * @param parentPartId - ID de la partie parente
 * @param oldNumber - Ancien numéro du chapitre
 * @param newNumber - Nouveau numéro (doit exister)
 * @param excludeChapterId - ID du chapitre à modifier (à exclure du décalage)
 */
export async function renumberChaptersAfterUpdate(
    parentPartId: string,
    oldNumber: number,
    newNumber: number,
    excludeChapterId: string
): Promise<void> {
    if (oldNumber === newNumber) return;

    if (oldNumber < newNumber) {
        // Déplacement vers le haut
        const chaptersToUpdate = await prisma.chapter.findMany({
            where: {
                parent_part: parentPartId,
                chapter_number: {
                    gt: oldNumber,
                    lte: newNumber,
                },
                chapter_id: {
                    not: excludeChapterId,
                },
            },
            orderBy: {
                chapter_number: "asc",
            },
        });

        for (const chapter of chaptersToUpdate) {
            await prisma.chapter.update({
                where: {
                    chapter_id: chapter.chapter_id,
                },
                data: {
                    chapter_number: chapter.chapter_number - 1,
                },
            });
        }
    } else {
        // Déplacement vers le bas
        const chaptersToUpdate = await prisma.chapter.findMany({
            where: {
                parent_part: parentPartId,
                chapter_number: {
                    gte: newNumber,
                    lt: oldNumber,
                },
                chapter_id: {
                    not: excludeChapterId,
                },
            },
            orderBy: {
                chapter_number: "desc",
            },
        });

        for (const chapter of chaptersToUpdate) {
            await prisma.chapter.update({
                where: {
                    chapter_id: chapter.chapter_id,
                },
                data: {
                    chapter_number: chapter.chapter_number + 1,
                },
            });
        }
    }
}

// ==========================================
// FONCTIONS POUR LES PARAGRAPHS (PARAGRAPHES)
// ==========================================

/**
 * Renumérotation des paragraphes après suppression
 * Décrémente tous les numéros > au numéro supprimé
 * @param parentChapterId - ID du chapitre parent
 * @param deletedNumber - Numéro du paragraphe supprimé
 */
export async function renumberParagraphsAfterDelete(
    parentChapterId: string,
    deletedNumber: number
): Promise<void> {
    const paragraphsToUpdate = await prisma.paragraph.findMany({
        where: {
            parent_chapter: parentChapterId,
            para_number: {
                gt: deletedNumber,
            },
        },
        orderBy: {
            para_number: "asc",
        },
    });

    for (const paragraph of paragraphsToUpdate) {
        await prisma.paragraph.update({
            where: {
                para_id: paragraph.para_id,
            },
            data: {
                para_number: paragraph.para_number - 1,
            },
        });
    }
}

/**
 * Renumérotation des paragraphes lors d'un changement de numéro
 * Le nouveau numéro DOIT exister pour déclencher le décalage
 *
 * @param parentChapterId - ID du chapitre parent
 * @param oldNumber - Ancien numéro du paragraphe
 * @param newNumber - Nouveau numéro (doit exister)
 * @param excludeParagraphId - ID du paragraphe à modifier (à exclure du décalage)
 */
export async function renumberParagraphsAfterUpdate(
    parentChapterId: string,
    oldNumber: number,
    newNumber: number,
    excludeParagraphId: string
): Promise<void> {
    if (oldNumber === newNumber) return;

    if (oldNumber < newNumber) {
        // Déplacement vers le haut
        const paragraphsToUpdate = await prisma.paragraph.findMany({
            where: {
                parent_chapter: parentChapterId,
                para_number: {
                    gt: oldNumber,
                    lte: newNumber,
                },
                para_id: {
                    not: excludeParagraphId,
                },
            },
            orderBy: {
                para_number: "asc",
            },
        });

        for (const paragraph of paragraphsToUpdate) {
            await prisma.paragraph.update({
                where: {
                    para_id: paragraph.para_id,
                },
                data: {
                    para_number: paragraph.para_number - 1,
                },
            });
        }
    } else {
        // Déplacement vers le bas
        const paragraphsToUpdate = await prisma.paragraph.findMany({
            where: {
                parent_chapter: parentChapterId,
                para_number: {
                    gte: newNumber,
                    lt: oldNumber,
                },
                para_id: {
                    not: excludeParagraphId,
                },
            },
            orderBy: {
                para_number: "desc",
            },
        });

        for (const paragraph of paragraphsToUpdate) {
            await prisma.paragraph.update({
                where: {
                    para_id: paragraph.para_id,
                },
                data: {
                    para_number: paragraph.para_number + 1,
                },
            });
        }
    }
}

// ==========================================
// FONCTIONS POUR LES NOTIONS
// ==========================================

/**
 * Renumérotation des notions après suppression
 * Décrémente tous les numéros > au numéro supprimé
 * @param parentParagraphId - ID du paragraphe parent
 * @param deletedNumber - Numéro de la notion supprimée
 */
export async function renumberNotionsAfterDelete(
    parentParagraphId: string,
    deletedNumber: number
): Promise<void> {
    const notionsToUpdate = await prisma.notion.findMany({
        where: {
            parent_para: parentParagraphId,
            notion_number: {
                gt: deletedNumber,
            },
        },
        orderBy: {
            notion_number: "asc",
        },
    });

    for (const notion of notionsToUpdate) {
        await prisma.notion.update({
            where: {
                notion_id: notion.notion_id,
            },
            data: {
                notion_number: notion.notion_number - 1,
            },
        });
    }
}

/**
 * Renumérotation des notions lors d'un changement de numéro
 * Le nouveau numéro DOIT exister pour déclencher le décalage
 *
 * @param parentParagraphId - ID du paragraphe parent
 * @param oldNumber - Ancien numéro de la notion
 * @param newNumber - Nouveau numéro (doit exister)
 * @param excludeNotionId - ID de la notion à modifier (à exclure du décalage)
 */
export async function renumberNotionsAfterUpdate(
    parentParagraphId: string,
    oldNumber: number,
    newNumber: number,
    excludeNotionId: string
): Promise<void> {
    if (oldNumber === newNumber) return;

    if (oldNumber < newNumber) {
        // Déplacement vers le haut
        const notionsToUpdate = await prisma.notion.findMany({
            where: {
                parent_para: parentParagraphId,
                notion_number: {
                    gt: oldNumber,
                    lte: newNumber,
                },
                notion_id: {
                    not: excludeNotionId,
                },
            },
            orderBy: {
                notion_number: "asc",
            },
        });

        for (const notion of notionsToUpdate) {
            await prisma.notion.update({
                where: {
                    notion_id: notion.notion_id,
                },
                data: {
                    notion_number: notion.notion_number - 1,
                },
            });
        }
    } else {
        // Déplacement vers le bas
        const notionsToUpdate = await prisma.notion.findMany({
            where: {
                parent_para: parentParagraphId,
                notion_number: {
                    gte: newNumber,
                    lt: oldNumber,
                },
                notion_id: {
                    not: excludeNotionId,
                },
            },
            orderBy: {
                notion_number: "desc",
            },
        });

        for (const notion of notionsToUpdate) {
            await prisma.notion.update({
                where: {
                    notion_id: notion.notion_id,
                },
                data: {
                    notion_number: notion.notion_number + 1,
                },
            });
        }
    }
}
