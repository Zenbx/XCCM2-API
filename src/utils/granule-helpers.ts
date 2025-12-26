/**
 * @fileoverview Fonctions utilitaires pour la gestion des granules
 * Gère la renumérotation automatique lors de la création, modification et suppression
 */

import prisma from "@/lib/prisma";

/**
 * Renumérotation des parties après insertion d'une nouvelle partie
 * Décale tous les numéros >= au numéro inséré
 * @param parentProjectId - ID du projet parent
 * @param insertedNumber - Numéro de la partie insérée
 */
export async function renumberPartsAfterInsert(
    parentProjectId: string,
    insertedNumber: number
): Promise<void> {
    // Récupère toutes les parties avec un numéro >= au numéro inséré
    const partsToUpdate = await prisma.part.findMany({
        where: {
            parent_pr: parentProjectId,
            part_number: {
                gte: insertedNumber,
            },
        },
        orderBy: {
            part_number: "desc", // Ordre décroissant pour éviter les conflits d'unicité
        },
    });

    // Incrémente chaque numéro de 1
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
 * @param parentProjectId - ID du projet parent
 * @param oldNumber - Ancien numéro
 * @param newNumber - Nouveau numéro
 * @param excludePartId - ID de la partie à exclure de la renumérotation
 */
export async function renumberPartsAfterUpdate(
    parentProjectId: string,
    oldNumber: number,
    newNumber: number,
    excludePartId: string
): Promise<void> {
    if (oldNumber === newNumber) return;

    if (newNumber > oldNumber) {
        // Décrémente les parties entre oldNumber et newNumber
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
    } else {
        // Incrémente les parties entre newNumber et oldNumber
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
                part_number: "desc",
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
// FONCTIONS SIMILAIRES POUR LES CHAPTERS
// ==========================================

export async function renumberChaptersAfterInsert(
    parentPartId: string,
    insertedNumber: number
): Promise<void> {
    const chaptersToUpdate = await prisma.chapter.findMany({
        where: {
            parent_part: parentPartId,
            chapter_number: {
                gte: insertedNumber,
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

export async function renumberChaptersAfterUpdate(
    parentPartId: string,
    oldNumber: number,
    newNumber: number,
    excludeChapterId: string
): Promise<void> {
    if (oldNumber === newNumber) return;

    if (newNumber > oldNumber) {
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
// FONCTIONS POUR LES PARAGRAPHS
// Note: Les paragraphes utilisent des numéros en string (ex: "1.1", "2.3")
// On trie par ordre alphabétique naturel
// ==========================================

/**
 * Compare deux numéros de paragraphe pour le tri naturel
 * @param a - Premier numéro
 * @param b - Deuxième numéro
 * @returns Résultat de comparaison pour sort()
 */
function compareParaNumbers(a: string, b: string): number {
    const aParts = a.split(".").map(Number);
    const bParts = b.split(".").map(Number);

    const maxLength = Math.max(aParts.length, bParts.length);

    for (let i = 0; i < maxLength; i++) {
        const aVal = aParts[i] || 0;
        const bVal = bParts[i] || 0;

        if (aVal !== bVal) {
            return aVal - bVal;
        }
    }

    return 0;
}

// Pour les paragraphes, pas de renumérotation automatique car les numéros sont en string
// L'utilisateur gère manuellement la numérotation (ex: 1.1, 1.2, 2.1, etc.)