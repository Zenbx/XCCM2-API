/**
 * @fileoverview Route API pour récupérer la structure complète d'un projet
 * Optimisé avec un seul appel et cache Redis
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { cacheService } from "@/services/cache-service";
import {
    successResponse,
    errorResponse,
    notFoundResponse,
    serverErrorResponse,
} from "@/utils/api-response";

type RouteParams = {
    params: Promise<{ pr_name: string }>;
};

const CACHE_TTL = 1800; // 30 minutes

/**
 * Handler GET pour récupérer la structure complète du projet en 1 seul appel
 */
export async function GET(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Utilisateur non authentifié", undefined, 401);
        }

        const { pr_name: encodedName } = await context.params;
        const pr_name = decodeURIComponent(encodedName);

        const cacheKey = `project:structure:${pr_name}:${userId}`;

        // 1. Essayer le cache Redis
        const cachedStructure = await cacheService.get<any>(cacheKey);
        if (cachedStructure) {
            console.log(`⚡ Cache hit for project structure: ${pr_name}`);
            return successResponse("Structure récupérée avec succès (cache)", cachedStructure);
        }

        console.log(`🐢 Cache miss for project structure: ${pr_name}, querying database...`);

        // 2. Vérifier que le projet existe et appartient à l'utilisateur
        const projects = await prisma.project.findMany({
            where: {
                pr_name,
                OR: [
                    { owner_id: userId },
                    {
                        invitations: {
                            some: {
                                guest_id: userId,
                                invitation_state: "Accepted"
                            }
                        }
                    }
                ]
            }
        });

        // 🚨 Priorité au projet possédé par l'utilisateur s'il y a plusieurs matches
        const project = projects.find(p => p.owner_id === userId) || projects[0];

        if (!project) {
            return notFoundResponse("Projet non trouvé ou accès refusé");
        }

        // 3. Récupérer TOUTE la structure en 1 seul appel (Prisma magic ✨)
        const parts = await prisma.part.findMany({
            where: {
                parent_pr: project.pr_id,
            },
            orderBy: { part_number: 'asc' },
            include: {
                chapters: {
                    orderBy: { chapter_number: 'asc' },
                    include: {
                        paragraphs: {
                            orderBy: { para_number: 'asc' },
                            include: {
                                notions: {
                                    orderBy: { notion_number: 'asc' }
                                }
                            }
                        }
                    }
                }
            }
        });

        const result = {
            project: {
                pr_id: project.pr_id,
                pr_name: project.pr_name,
                description: project.description,
                category: project.category,
                level: project.level,
                is_published: project.is_published,
            },
            structure: parts,
            count: {
                parts: parts.length,
                chapters: parts.reduce((sum, p) => sum + p.chapters.length, 0),
                paragraphs: parts.reduce((sum, p) =>
                    sum + p.chapters.reduce((s, c) => s + c.paragraphs.length, 0), 0),
                notions: parts.reduce((sum, p) =>
                    sum + p.chapters.reduce((s, c) =>
                        s + c.paragraphs.reduce((ss, para) => ss + para.notions.length, 0), 0), 0),
            }
        };

        // 4. Mettre en cache
        await cacheService.set(cacheKey, result, CACHE_TTL);

        console.log(`✅ Structure loaded and cached for ${pr_name}`);

        return successResponse("Structure récupérée avec succès", result);

    } catch (error) {
        console.error("Erreur lors de la récupération de la structure:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la récupération de la structure",
            error instanceof Error ? error.message : undefined
        );
    }
}
