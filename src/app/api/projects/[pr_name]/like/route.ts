/**
 * @openapi
 * /api/projects/{pr_name}/like:
 *   post:
 *     tags:
 *       - Projects
 *     summary: Liker / unliker un projet
 *     description: Alterne le like de l'utilisateur authentifié sur le projet.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pr_name
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: État du like
 *       401:
 *         description: Non authentifié
 *       404:
 *         description: Projet introuvable
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { successResponse, errorResponse } from "@/utils/api-response";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ pr_name: string }> }
) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) {
            return errorResponse("Non authentifié", undefined, 401);
        }

        const { pr_name } = await params;
        const decodedName = decodeURIComponent(pr_name);

        const candidates = await prisma.project.findMany({
            where: { pr_name: decodedName },
            select: { pr_id: true, is_published: true, owner_id: true },
        });

        if (candidates.length === 0) {
            return errorResponse("Projet introuvable", undefined, 404);
        }

        // Un seul match, sinon : projet de l'utilisateur, sinon publié, sinon premier
        const project =
            candidates.length === 1
                ? candidates[0]
                : candidates.find((p) => p.owner_id === userId) ||
                  candidates.find((p) => p.is_published) ||
                  candidates[0];

        const existing = await prisma.projectLike.findUnique({
            where: {
                liker_id_project_id: {
                    liker_id: userId,
                    project_id: project.pr_id,
                },
            },
        });

        let isLiked: boolean;
        if (existing) {
            await prisma.projectLike.delete({ where: { id: existing.id } });
            isLiked = false;
        } else {
            await prisma.projectLike.create({
                data: {
                    liker_id: userId,
                    project_id: project.pr_id,
                },
            });
            isLiked = true;
        }

        const likes = await prisma.projectLike.count({
            where: { project_id: project.pr_id },
        });

        return successResponse("Like mis à jour", { likes, isLiked }, 200);
    } catch (error) {
        console.error("Erreur lors du like du projet:", error);
        return errorResponse(
            "Erreur lors du like du projet",
            undefined,
            500
        );
    }
}
