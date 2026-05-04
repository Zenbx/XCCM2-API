/**
 * @openapi
 * /api/projects/{pr_name}/invitations:
 *   get:
 *     tags:
 *       - Invitations
 *     summary: Lister les invitations d'un projet
 *     description: Retourne toutes les invitations (tous statuts) pour un projet dont l'utilisateur est propriétaire.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pr_name
 *         required: true
 *         schema:
 *           type: string
 *         description: Nom du projet (URL-encoded si nécessaire)
 *     responses:
 *       200:
 *         description: Invitations récupérées
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     invitations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           guest_email:
 *                             type: string
 *                           guest_name:
 *                             type: string
 *                           status:
 *                             type: string
 *                           invited_at:
 *                             type: string
 *                             format: date-time
 *       401:
 *         description: Non authentifié
 *       404:
 *         description: Projet non trouvé
 */
/**
 * @fileoverview Route API pour récupérer les invitations d'un projet
 * GET /api/projects/[pr_name]/invitations
 *
 * Documentation Swagger dans: src/lib/swagger-invitations.ts
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    serverErrorResponse,
} from "@/utils/api-response";
import { getPendingInvitationsByProject } from "@/utils/invitation-helpers";


export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ pr_name: string }> }
) {
    try {
        // Récupérer l'userId depuis le header (injecté par le middleware)
        const userId = request.headers.get("x-user-id");
        if (!userId) {
            return errorResponse("Non authentifié", undefined, 401);
        }

        const { pr_name: encodedName } = await params;
        const pr_name = decodeURIComponent(encodedName);

        // Récupérer le projet
        const project = await prisma.project.findUnique({
            where: {
                pr_name_owner_id: {
                    pr_name,
                    owner_id: userId,
                },
            },
        });

        if (!project) {
            return errorResponse("Projet non trouvé ou vous n'êtes pas autorisé à y accéder", undefined, 404);
        }

        // Récupérer TOUTES les invitations liées au projet
        const invitations = await prisma.invitation.findMany({
            where: {
                pr_id: project.pr_id,
            },
            include: {
                guest: {
                    select: {
                        email: true,
                        firstname: true,
                        lastname: true,
                    },
                },
            },
            orderBy: {
                invited_at: "desc",
            },
        });

        return successResponse(
            "Invitations récupérées avec succès",
            {
                invitations: invitations.map((inv: any) => ({
                    id: inv.id,
                    guest_email: inv.guest.email,
                    guest_name: `${inv.guest.firstname || ''} ${inv.guest.lastname || ''}`.trim() || inv.guest.email,
                    status: inv.invitation_state,
                    role: inv.role,
                    invited_at: inv.invited_at,
                    response_at: inv.response_at,
                })),
            },
            200
        );
    } catch (error) {
        console.error("Erreur lors de la récupération des invitations:", error);
        return serverErrorResponse(
            error instanceof Error
                ? error.message
                : "Erreur lors de la récupération des invitations"
        );
    }
}
