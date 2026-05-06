/**
 * @fileoverview Routes API pour la gestion du coffre-fort (Vault)
 * Gère l'ajout et la récupération des granules sauvegardés par l'utilisateur
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    serverErrorResponse,
} from "@/utils/api-response";

/**
 * @openapi
 * /api/vault:
 *   get:
 *     tags:
 *       - Vault
 *     summary: Récupérer tous les éléments du coffre-fort
 *     description: Retourne tous les granules et fichiers sauvegardés par l'utilisateur connecté.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Éléments récupérés
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/VaultItem' }
 *   post:
 *     tags:
 *       - Vault
 *     summary: Ajouter un élément au coffre-fort
 *     description: Sauvegarde un granule, une image ou tout autre contenu dans le coffre personnel.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, title, original_id]
 *             properties:
 *               type: { type: string, description: "Type de contenu (img, video, text, part, etc.)" }
 *               title: { type: string }
 *               original_id: { type: string, description: "ID de l'objet source" }
 *               content: { type: string }
 *               file_url: { type: string }
 *               source_doc_id: { type: string }
 *               source_doc_name: { type: string }
 *     responses:
 *       201:
 *         description: Élément sauvegardé
 *       401:
 *         description: Non autorisé
 *       409:
 *         description: Déjà présent dans le coffre
 */
export async function GET(request: NextRequest) {
    try {
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Utilisateur non authentifié", undefined, 401);
        }

        const { searchParams } = new URL(request.url);
        const cursor = searchParams.get('cursor');
        const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);

        const vaultItems = await prisma.vaultItem.findMany({
            where: { owner_id: userId },
            orderBy: { added_at: "desc" },
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });

        const hasMore = vaultItems.length > limit;
        const page = hasMore ? vaultItems.slice(0, limit) : vaultItems;
        const nextCursor = hasMore ? page[page.length - 1].id : null;

        return successResponse("Éléments du coffre-fort récupérés", { items: page, nextCursor, hasMore });
    } catch (error) {
        console.error("Erreur GET Vault:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la récupération du coffre-fort",
            error instanceof Error ? error.message : undefined
        );
    }
}

/**
 * Handler POST pour ajouter un élément au coffre-fort
 */
export async function POST(request: NextRequest) {
    try {
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Utilisateur non authentifié", undefined, 401);
        }

        const body = await request.json();
        const { type, title, original_id, source_doc_id, source_doc_name, content, file_url } = body;

        if (!type || !title || !original_id) {
            return errorResponse("Données manquantes (type, title, original_id requis)", undefined, 400);
        }

        // Vérifier si l'élément est déjà dans le coffre (optionnel, mais recommandé)
        const existing = await prisma.vaultItem.findFirst({
            where: {
                owner_id: userId,
                original_id: original_id
            }
        });

        if (existing) {
            return errorResponse("Cet élément est déjà dans votre coffre-fort", undefined, 409);
        }

        const vaultItem = await prisma.vaultItem.create({
            data: {
                type,
                title,
                original_id,
                source_doc_id,
                source_doc_name,
                content,
                file_url,
                owner_id: userId,
            },
        });

        return successResponse("Élément ajouté au coffre-fort", vaultItem, 201);
    } catch (error) {
        console.error("Erreur POST Vault:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de l'ajout au coffre-fort",
            error instanceof Error ? error.message : undefined
        );
    }
}
