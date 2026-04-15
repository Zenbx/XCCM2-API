import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { createCommentSchema } from "@/utils/validation";
import {
    successResponse,
    errorResponse,
    notFoundResponse,
    validationErrorResponse,
    serverErrorResponse,
} from "@/utils/api-response";
import { ZodError } from "zod";

/**
 * Type pour les paramètres de route
 */
type RouteParams = {
    params: Promise<{ pr_name: string }>;
};

/**
 * @openapi
 * /api/projects/{pr_name}/comments:
 *   get:
 *     tags:
 *       - Projects
 *     summary: Lister les commentaires d'un projet
 *     description: Récupère tous les commentaires (discussions) laissés sur le projet.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pr_name
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Liste des commentaires récupérée
 *   post:
 *     tags:
 *       - Projects
 *     summary: Ajouter un commentaire
 *     description: Poste un nouveau message dans la discussion du projet.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pr_name
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: string }
 *     responses:
 *       201:
 *         description: Commentaire créé
 */
export async function GET(
    request: NextRequest,
    context: RouteParams
) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Non authentifié", undefined, 401);

        const { pr_name: encodedName } = await context.params;
        const pr_name = decodeURIComponent(encodedName);

        const project = await prisma.project.findFirst({
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

        if (!project) return notFoundResponse("Projet non trouvé");

        const comments = await prisma.comment.findMany({
            where: { pr_id: project.pr_id },
            include: {
                author: {
                    select: {
                        user_id: true,
                        firstname: true,
                        lastname: true,
                        email: true
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        });

        return successResponse("Commentaires récupérés", { comments });
    } catch (error) {
        return serverErrorResponse("Erreur recup commentaires", error instanceof Error ? error.message : undefined);
    }
}

/**
 * POST: Ajouter un commentaire à un projet
 */
export async function POST(
    request: NextRequest,
    context: RouteParams
) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Non authentifié", undefined, 401);

        const { pr_name: encodedName } = await context.params;
        const pr_name = decodeURIComponent(encodedName);

        const project = await prisma.project.findFirst({
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

        if (!project) return notFoundResponse("Projet non trouvé");

        const body = await request.json();
        const validatedData = createCommentSchema.parse(body);

        const comment = await prisma.comment.create({
            data: {
                content: validatedData.content,
                author_id: userId,
                pr_id: project.pr_id
            },
            include: {
                author: {
                    select: {
                        user_id: true,
                        firstname: true,
                        lastname: true,
                        email: true
                    }
                }
            }
        });

        // 📡 Broadcast temps réel
        try {
            const { realtimeService } = await import("@/services/realtime-service");
            await realtimeService.broadcastStructureChange(
                pr_name,
                'COMMENT_ADDED',
                {
                    comment,
                    action: 'created'
                }
            );
        } catch (error) {
            console.error("Erreur broadcast commentaire:", error);
        }

        return successResponse("Commentaire ajouté", { comment }, 201);
    } catch (error) {
        if (error instanceof ZodError) return validationErrorResponse(error.flatten().fieldErrors);
        return serverErrorResponse("Erreur ajout commentaire", error instanceof Error ? error.message : undefined);
    }
}
