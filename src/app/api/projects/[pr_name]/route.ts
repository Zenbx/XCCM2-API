/**
 * @fileoverview Routes API pour un projet spécifique
 * Gère la récupération, modification et suppression d'un projet par son nom
 *
 * @swagger
 * /api/projects/{pr_name}:
 *   get:
 *     tags:
 *       - Projects
 *     summary: Récupérer un projet spécifique
 *     description: Récupère un projet par son nom (pour l'utilisateur authentifié)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pr_name
 *         required: true
 *         schema:
 *           type: string
 *         description: Nom du projet
 *         example: Mon Super Projet
 *     responses:
 *       200:
 *         description: Projet récupéré avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Projet récupéré avec succès
 *                 data:
 *                   type: object
 *                   properties:
 *                     project:
 *                       $ref: '#/components/schemas/ProjectWithOwner'
 *       401:
 *         description: Non autorisé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         description: Projet non trouvé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *   patch:
 *     tags:
 *       - Projects
 *     summary: Modifier le nom d'un projet
 *     description: Met à jour le nom d'un projet existant (updated_at est automatiquement mis à jour)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pr_name
 *         required: true
 *         schema:
 *           type: string
 *         description: Nom actuel du projet
 *         example: Mon Super Projet
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pr_name
 *             properties:
 *               pr_name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 100
 *                 example: Mon Projet Renommé
 *                 description: Nouveau nom du projet
 *     responses:
 *       200:
 *         description: Projet modifié avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Projet modifié avec succès
 *                 data:
 *                   type: object
 *                   properties:
 *                     project:
 *                       $ref: '#/components/schemas/Project'
 *       400:
 *         description: Données invalides
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       401:
 *         description: Non autorisé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         description: Projet non trouvé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       409:
 *         description: Un projet avec ce nouveau nom existe déjà
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       422:
 *         description: Erreur de validation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *   delete:
 *     tags:
 *       - Projects
 *     summary: Supprimer un projet
 *     description: Supprime définitivement un projet et toutes ses données associées
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pr_name
 *         required: true
 *         schema:
 *           type: string
 *         description: Nom du projet à supprimer
 *         example: Mon Super Projet
 *     responses:
 *       200:
 *         description: Projet supprimé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Projet supprimé avec succès
 *       401:
 *         description: Non autorisé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         description: Projet non trouvé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { updateProjectSchema } from "@/utils/validation";
import {
    successResponse,
    errorResponse,
    notFoundResponse,
    validationErrorResponse,
    serverErrorResponse,
} from "@/utils/api-response";
import { ZodError } from "zod";

/**
 * Type pour les paramètres de route (Next.js 15+)
 */
type RouteParams = {
    params: Promise<{ pr_name: string }>;
};

/**
 * Handler GET pour récupérer un projet spécifique
 * @param request - Requête Next.js
 * @param context - Contexte avec les paramètres de route
 * @returns Réponse JSON avec le projet
 */
export async function GET(
    request: NextRequest,
    context: RouteParams
) {
    try {
        // Récupère l'userId depuis le header
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Utilisateur non authentifié", undefined, 401);
        }

        // Await les params (Next.js 15+)
        const { pr_name: encodedName } = await context.params;

        // Décode le nom du projet (au cas où il contient des espaces ou caractères spéciaux)
        const pr_name = decodeURIComponent(encodedName);

        console.log("🔍 Recherche du projet:", { pr_name, userId });

        // Recherche le projet par son nom ET soit il appartient à l'utilisateur,
        // soit l'utilisateur y est invité (Accepté).
        const project = await prisma.project.findFirst({
            where: {
                pr_name: pr_name,
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
            },
            include: {
                owner: {
                    select: {
                        user_id: true,
                        email: true,
                        firstname: true,
                        lastname: true,
                    },
                },
            },
        });

        if (!project) {
            console.log("❌ Projet non trouvé");
            return notFoundResponse("Projet non trouvé");
        }

        // Vérifier les droits d'accès
        const isOwner = project.owner_id === userId;

        // Si pas propriétaire, vérifier l'invitation
        let isInvited = false;
        if (!isOwner) {
            const invitation = await prisma.invitation.findFirst({
                where: {
                    pr_id: project.pr_id,
                    guest_id: userId,
                    invitation_state: "Accepted"
                }
            });
            isInvited = !!invitation;
        }

        if (!isOwner && !isInvited) {
            console.log("❌ Accès refusé pour cet utilisateur");
            return errorResponse("Accès refusé au projet", undefined, 403);
        }

        console.log("✅ Accès accordé:", project.pr_id);
        return successResponse("Projet récupéré avec succès", {
            project: {
                ...project,
                user_role: isOwner ? 'OWNER' : 'GUEST' // Optionnel: pour aider le front
            }
        });
    } catch (error) {
        console.error("Erreur lors de la récupération du projet:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la récupération du projet",
            error instanceof Error ? error.message : undefined
        );
    }
}

/**
 * Handler PATCH pour modifier le nom d'un projet
 * Note: Le champ updated_at est automatiquement mis à jour grâce à @updatedAt dans Prisma
 * @param request - Requête Next.js
 * @param context - Contexte avec les paramètres de route
 * @returns Réponse JSON avec le projet modifié
 */
export async function PATCH(
    request: NextRequest,
    context: RouteParams
) {
    try {
        // Récupère l'userId depuis le header
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Utilisateur non authentifié", undefined, 401);
        }

        // Await les params (Next.js 15+)
        const { pr_name: encodedName } = await context.params;

        // Décode le nom du projet actuel
        const currentName = decodeURIComponent(encodedName);

        // Parse le body de la requête
        const body = await request.json();

        // Validation avec Zod
        const validatedData = updateProjectSchema.parse(body);

        console.log("🔄 Modification du projet:", { currentName, newName: validatedData.pr_name, userId });

        // Vérifie si le projet existe
        const existingProject = await prisma.project.findUnique({
            where: {
                pr_name_owner_id: {
                    pr_name: currentName,
                    owner_id: userId,
                },
            },
        });

        if (!existingProject) {
            console.log("❌ Projet non trouvé pour modification");
            return notFoundResponse("Projet non trouvé");
        }

        // Si le nouveau nom est différent, vérifie qu'il n'existe pas déjà
        if (validatedData.pr_name && validatedData.pr_name !== currentName) {
            const duplicateProject = await prisma.project.findUnique({
                where: {
                    pr_name_owner_id: {
                        pr_name: validatedData.pr_name,
                        owner_id: userId,
                    },
                },
            });

            if (duplicateProject) {
                return errorResponse(
                    "Un projet avec ce nom existe déjà",
                    undefined,
                    409
                );
            }
        }

        // Mise à jour du projet (updated_at sera automatiquement mis à jour)
        const updatedProject = await prisma.project.update({
            where: {
                pr_name_owner_id: {
                    pr_name: currentName,
                    owner_id: userId,
                },
            },
            data: {
                pr_name: validatedData.pr_name,
                description: validatedData.description,
                category: validatedData.category,
                level: validatedData.level,
                tags: validatedData.tags,
                author: validatedData.author,
                language: validatedData.language,
                is_published: validatedData.is_published,
                styles: validatedData.styles,
            },
        });

        console.log("✅ Projet modifié avec succès");
        return successResponse("Projet modifié avec succès", {
            project: updatedProject,
        });
    } catch (error) {
        // Gestion des erreurs de validation Zod
        if (error instanceof ZodError) {
            const errors: Record<string, string[]> = {};
            error.issues.forEach((err) => {
                const field = err.path.join(".");
                if (!errors[field]) {
                    errors[field] = [];
                }
                errors[field].push(err.message);
            });
            return validationErrorResponse(errors);
        }

        // Erreur serveur générique
        console.error("Erreur lors de la modification du projet:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la modification du projet",
            error instanceof Error ? error.message : undefined
        );
    }
}

/**
 * Handler DELETE pour supprimer un projet
 * @param request - Requête Next.js
 * @param context - Contexte avec les paramètres de route
 * @returns Réponse JSON de confirmation
 */
export async function DELETE(
    request: NextRequest,
    context: RouteParams
) {
    try {
        // Récupère l'userId depuis le header
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Utilisateur non authentifié", undefined, 401);
        }

        // Await les params (Next.js 15+)
        const { pr_name: encodedName } = await context.params;

        // Décode le nom du projet
        const pr_name = decodeURIComponent(encodedName);

        console.log("🗑️ Suppression du projet:", { pr_name, userId });

        // Vérifie si le projet existe
        const existingProject = await prisma.project.findUnique({
            where: {
                pr_name_owner_id: {
                    pr_name,
                    owner_id: userId,
                },
            },
        });

        if (!existingProject) {
            console.log("❌ Projet non trouvé pour suppression");
            return notFoundResponse("Projet non trouvé");
        }

        // Suppression du projet (les relations en cascade seront gérées par Prisma)
        await prisma.project.delete({
            where: {
                pr_name_owner_id: {
                    pr_name,
                    owner_id: userId,
                },
            },
        });

        console.log("✅ Projet supprimé avec succès");
        return successResponse("Projet supprimé avec succès");
    } catch (error) {
        console.error("Erreur lors de la suppression du projet:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la suppression du projet",
            error instanceof Error ? error.message : undefined
        );
    }
}