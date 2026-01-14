/**
 * @fileoverview Route API publique pour lister les documents publiés
 *
 * @swagger
 * /api/documents:
 *   get:
 *     tags:
 *       - Documents
 *     summary: Récupérer la liste des documents publiés
 *     description: Retourne une liste de tous les projets qui ont été publiés, destinée à la bibliothèque publique.
 *     responses:
 *       200:
 *         description: Liste des documents récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     documents:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Project' # On retourne directement les projets publiés
 *       500:
 *         description: Erreur serveur
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    serverErrorResponse,
} from "@/utils/api-response";

/**
 * Handler GET pour récupérer tous les projets publiés
 * @param request - Requête Next.js
 * @returns Réponse JSON avec la liste des projets publiés
 */
export async function GET(request: NextRequest) {
    try {
        console.log("📚 Récupération des projets publiés pour la bibliothèque");

        const publishedProjects = await prisma.project.findMany({
            where: {
                is_published: true, // On ne sélectionne que les projets publiés
            },
            orderBy: {
                updated_at: "desc", // Les plus récents d'abord
            },
             // On inclut les données de l'auteur pour l'affichage
            include: {
                owner: {
                    select: {
                        firstname: true,
                        lastname: true,
                    }
                }
            }
        });
        
        // On transforme les données pour correspondre au format attendu par le front
        const documents = publishedProjects.map(p => ({
            ...p,
            // Créer un champ auteur complet si ce n'est pas déjà fait
            author: p.author || `${p.owner.firstname} ${p.owner.lastname}`.trim(), 
        }));


        return successResponse("Documents publiés récupérés avec succès", {
            documents,
        });

    } catch (error) {
        console.error("Erreur lors de la récupération des documents publiés:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la récupération des documents",
            error instanceof Error ? error.message : undefined
        );
    }
}
