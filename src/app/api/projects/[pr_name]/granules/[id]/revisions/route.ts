/**
 * GET  /api/projects/[pr_name]/granules/[id]/revisions
 *   → Historique des modifications d'une notion (30 dernières, du plus récent au plus ancien)
 *
 * POST /api/projects/[pr_name]/granules/[id]/revisions
 *   → Enregistre une nouvelle révision (appelé automatiquement par le PATCH granule)
 *   → Plafond : 30 révisions par notion — la plus ancienne est supprimée au-delà
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    notFoundResponse,
    serverErrorResponse,
} from "@/utils/api-response";

const MAX_REVISIONS_PER_NOTION = 30;

type RouteParams = { params: Promise<{ pr_name: string; id: string }> };

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Non authentifié", undefined, 401);

        const { pr_name: encodedPrName, id: notionId } = await context.params;
        const pr_name = decodeURIComponent(encodedPrName).trim();

        // Vérifier accès au projet (propriétaire ou collaborateur accepté)
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

        const revisions = await prisma.granuleRevision.findMany({
            where: { notion_id: notionId, project_id: project.pr_id },
            orderBy: { created_at: "desc" },
            take: MAX_REVISIONS_PER_NOTION,
            include: {
                author: {
                    select: { user_id: true, firstname: true, lastname: true, profile_picture: true },
                },
            },
        });

        return successResponse("Historique récupéré", { revisions });
    } catch (err) {
        console.error("[granule/revisions GET]", err);
        return serverErrorResponse("Erreur serveur");
    }
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Non authentifié", undefined, 401);

        const { pr_name: encodedPrName, id: notionId } = await context.params;
        const pr_name = decodeURIComponent(encodedPrName).trim();
        const { content_before, content_after } = await request.json();

        if (content_before === undefined || content_after === undefined) {
            return errorResponse("content_before et content_after sont requis", undefined, 400);
        }

        // Pas de révision si le contenu n'a pas changé
        if (content_before === content_after) {
            return successResponse("Aucun changement détecté", { revision: null });
        }

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

        // Vérifier que la notion appartient bien à ce projet
        const notion = await prisma.notion.findFirst({
            where: {
                notion_id: notionId,
                paragraph: { chapter: { part: { parent_pr: project.pr_id } } },
            },
        });
        if (!notion) return notFoundResponse("Notion non trouvée");

        // Créer la révision
        const revision = await prisma.granuleRevision.create({
            data: {
                notion_id:      notionId,
                project_id:     project.pr_id,
                author_id:      userId,
                content_before,
                content_after,
            },
            include: {
                author: {
                    select: { user_id: true, firstname: true, lastname: true, profile_picture: true },
                },
            },
        });

        // Plafond : supprimer les révisions au-delà de MAX_REVISIONS_PER_NOTION
        const count = await prisma.granuleRevision.count({ where: { notion_id: notionId } });
        if (count > MAX_REVISIONS_PER_NOTION) {
            const oldest = await prisma.granuleRevision.findMany({
                where: { notion_id: notionId },
                orderBy: { created_at: "asc" },
                take: count - MAX_REVISIONS_PER_NOTION,
                select: { id: true },
            });
            await prisma.granuleRevision.deleteMany({
                where: { id: { in: oldest.map((r) => r.id) } },
            });
        }

        return successResponse("Révision enregistrée", { revision });
    } catch (err) {
        console.error("[granule/revisions POST]", err);
        return serverErrorResponse("Erreur serveur");
    }
}
