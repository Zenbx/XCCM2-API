/**
 * @fileoverview Routes pour la gestion du Versioning des projets
 * - GET  : Liste des révisions d'un projet (max 5, triées par date desc)
 * - POST : Sauvegarde une nouvelle révision avec capping automatique
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    notFoundResponse,
    serverErrorResponse,
} from "@/utils/api-response";
import { z } from "zod";

type RouteParams = {
    params: Promise<{ pr_name: string }>;
};

const MAX_REVISIONS_PER_PROJECT = 5;

const postSchema = z.object({
    label: z.string().max(100).optional(),
});

/**
 * @openapi
 * /api/projects/{pr_name}/revisions:
 *   get:
 *     tags:
 *       - Projects
 *     summary: Lister les révisions (snapshots) du projet
 *     description: Récupère les 5 dernières sauvegardes manuelles de la structure du projet.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pr_name
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Liste des révisions récupérée
 *   post:
 *     tags:
 *       - Projects
 *     summary: Créer une nouvelle révision (Snapshot)
 *     description: Sauvegarde l'état actuel de la structure du projet. Max 5 par projet.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pr_name
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label: { type: string, description: "Nom de la révision" }
 *     responses:
 *       201:
 *         description: Révision sauvegardée
 */
export async function GET(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Utilisateur non authentifié", undefined, 401);

        const { pr_name: encodedName } = await context.params;
        const pr_name = decodeURIComponent(encodedName);

        // Vérifier que le projet appartient à l'utilisateur ou est partagé avec lui
        const project = await prisma.project.findFirst({
            where: {
                pr_name,
                OR: [
                    { owner_id: userId },
                    { invitations: { some: { guest_id: userId, invitation_state: "Accepted" } } },
                ],
            },
        });

        if (!project) return notFoundResponse("Projet non trouvé");

        const revisions = await prisma.projectRevision.findMany({
            where: { project_id: project.pr_id },
            orderBy: { created_at: "desc" },
            select: {
                id: true,
                label: true,
                created_at: true,
                creator: {
                    select: { firstname: true, lastname: true },
                },
            },
        });

        return successResponse("Révisions récupérées avec succès", {
            revisions,
            count: revisions.length,
            max: MAX_REVISIONS_PER_PROJECT,
        });
    } catch (error) {
        return serverErrorResponse("Erreur lors de la récupération des révisions", error instanceof Error ? error.message : undefined);
    }
}

/**
 * POST /api/projects/:pr_name/revisions
 * Crée un snapshot complet du projet.
 * Si le cap (5) est atteint, supprime la révision la plus ancienne avant d'insérer.
 */
export async function POST(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Utilisateur non authentifié", undefined, 401);

        const { pr_name: encodedName } = await context.params;
        const pr_name = decodeURIComponent(encodedName);

        const body = await request.json().catch(() => ({}));
        const parsed = postSchema.safeParse(body);
        if (!parsed.success) return errorResponse("Données invalides", JSON.stringify(parsed.error.format()), 400);

        const { label } = parsed.data;

        // Vérifier que l'utilisateur possède le projet (seul le owner peut sauvegarder)
        const project = await prisma.project.findFirst({
            where: { pr_name, owner_id: userId },
        });
        if (!project) return notFoundResponse("Projet non trouvé ou accès refusé");

        // Construire le snapshot complet de la structure
        const parts = await prisma.part.findMany({
            where: { parent_pr: project.pr_id },
            orderBy: { part_number: "asc" },
            include: {
                chapters: {
                    orderBy: { chapter_number: "asc" },
                    include: {
                        paragraphs: {
                            orderBy: { para_number: "asc" },
                            include: {
                                notions: { orderBy: { notion_number: "asc" } },
                            },
                        },
                    },
                },
            },
        });

        const snapshot = {
            project: {
                pr_id: project.pr_id,
                pr_name: project.pr_name,
                description: project.description,
                category: project.category,
                level: project.level,
                tags: project.tags,
                author: project.author,
                language: project.language,
            },
            structure: parts,
        };

        // --- CAPPING : supprime la plus ancienne si on dépasse le max ---
        const existingRevisions = await prisma.projectRevision.findMany({
            where: { project_id: project.pr_id },
            orderBy: { created_at: "asc" },
            select: { id: true },
        });

        if (existingRevisions.length >= MAX_REVISIONS_PER_PROJECT) {
            const oldestId = existingRevisions[0].id;
            await prisma.projectRevision.delete({ where: { id: oldestId } });
            console.log(`🗑️ Révision la plus ancienne supprimée (cap atteint): ${oldestId}`);
        }

        // Créer la nouvelle révision
        const revision = await prisma.projectRevision.create({
            data: {
                label: label || null,
                snapshot,
                project_id: project.pr_id,
                creator_id: userId,
            },
        });

        return successResponse("Révision sauvegardée avec succès", { revision }, 201);
    } catch (error) {
        return serverErrorResponse("Erreur lors de la sauvegarde de la révision", error instanceof Error ? error.message : undefined);
    }
}
