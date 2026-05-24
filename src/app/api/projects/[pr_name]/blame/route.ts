/**
 * GET /api/projects/[pr_name]/blame
 *
 * Retourne le dernier éditeur de chaque notion du projet.
 * Equivalent du "git blame" : pour chaque notion, qui a fait la dernière modification et quand.
 *
 * Réponse : { [notion_id]: { author, modified_at } }
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    notFoundResponse,
    serverErrorResponse,
} from "@/utils/api-response";

type RouteParams = { params: Promise<{ pr_name: string }> };

export async function GET(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Non authentifié", undefined, 401);

        const { pr_name: encodedPrName } = await context.params;
        const pr_name = decodeURIComponent(encodedPrName).trim();

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

        // Pour chaque notion du projet, récupérer la révision la plus récente
        // On regroupe par notion_id et on prend la dernière entrée
        const latestRevisions = await prisma.granuleRevision.findMany({
            where: { project_id: project.pr_id },
            orderBy: { created_at: "desc" },
            distinct: ["notion_id"],
            include: {
                author: {
                    select: {
                        user_id: true,
                        firstname: true,
                        lastname: true,
                        profile_picture: true,
                    },
                },
            },
        });

        // Transformer en map { notion_id → blame info }
        const blame: Record<string, { author: any; modified_at: string }> = {};
        for (const rev of latestRevisions) {
            blame[rev.notion_id] = {
                author:      rev.author,
                modified_at: rev.created_at.toISOString(),
            };
        }

        return successResponse("Blame récupéré", { blame });
    } catch (err) {
        console.error("[blame GET]", err);
        return serverErrorResponse("Erreur serveur");
    }
}
