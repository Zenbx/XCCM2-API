/**
 * @fileoverview Routes pour une révision spécifique d'un projet
 * - GET    : Détail complet d'une révision (snapshot inclus)
 * - DELETE : Supprime une révision
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    notFoundResponse,
    serverErrorResponse,
} from "@/utils/api-response";

type RouteParams = {
    params: Promise<{ pr_name: string; rev_id: string }>;
};

/**
 * GET /api/projects/:pr_name/revisions/:rev_id
 * Retourne le détail (y compris le snapshot) d'une révision
 */
export async function GET(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Utilisateur non authentifié", undefined, 401);

        const { pr_name: encodedName, rev_id } = await context.params;
        const pr_name = decodeURIComponent(encodedName);

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

        const revision = await prisma.projectRevision.findFirst({
            where: { id: rev_id, project_id: project.pr_id },
        });
        if (!revision) return notFoundResponse("Révision non trouvée");

        return successResponse("Révision récupérée", { revision });
    } catch (error) {
        return serverErrorResponse("Erreur", error instanceof Error ? error.message : undefined);
    }
}

/**
 * DELETE /api/projects/:pr_name/revisions/:rev_id
 * Supprime une révision (seul le propriétaire du projet peut le faire)
 */
export async function DELETE(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Utilisateur non authentifié", undefined, 401);

        const { pr_name: encodedName, rev_id } = await context.params;
        const pr_name = decodeURIComponent(encodedName);

        const project = await prisma.project.findFirst({
            where: { pr_name, owner_id: userId },
        });
        if (!project) return notFoundResponse("Projet non trouvé ou accès refusé");

        const revision = await prisma.projectRevision.findFirst({
            where: { id: rev_id, project_id: project.pr_id },
        });
        if (!revision) return notFoundResponse("Révision non trouvée");

        await prisma.projectRevision.delete({ where: { id: rev_id } });

        return successResponse("Révision supprimée avec succès");
    } catch (error) {
        return serverErrorResponse("Erreur lors de la suppression", error instanceof Error ? error.message : undefined);
    }
}
