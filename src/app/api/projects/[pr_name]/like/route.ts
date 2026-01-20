/**
 * @fileoverview Route API pour liker un projet
 * POST /api/projects/[pr_name]/like
 *
 * NOTE: Cette fonctionnalité est temporairement désactivée.
 * Le modèle de données actuel ne supporte que les likes sur les documents,
 * pas sur les projets. Retourne un succès dummy pour éviter les erreurs frontend.
 */

import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/utils/api-response";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ pr_name: string }> }
) {
    try {
        // Récupérer l'userId depuis le header (injecté par le middleware)
        const userId = request.headers.get("x-user-id");
        if (!userId) {
            return errorResponse("Non authentifié", undefined, 401);
        }

        const { pr_name } = await params;

        // TODO: Implémenter la vraie fonctionnalité de like sur les projets
        // Nécessite une migration Prisma pour ajouter un modèle ProjectLike
        // ou modifier le modèle Like existant

        // Pour l'instant, retourner un succès dummy
        return successResponse(
            "Like enregistré (fonctionnalité en développement)",
            {
                likes: 0,
                isLiked: true
            },
            200
        );

    } catch (error) {
        console.error("Erreur lors du like du projet:", error);
        return errorResponse(
            "Erreur lors du like du projet",
            undefined,
            500
        );
    }
}
