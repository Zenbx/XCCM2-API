/**
 * @fileoverview Routes API pour la Marketplace
 * Gère la publication et la récupération des granules partagés
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
 * /api/marketplace:
 *   get:
 *     tags:
 *       - Marketplace
 *     summary: Récupérer tous les items de la marketplace
 *     description: Retourne la liste des granules publiés avec filtres par type, catégorie et recherche textuelle.
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, part, chapter, paragraph, notion]
 *         description: Filtrer par type de granule
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filtrer par catégorie
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Recherche par mot-clé dans le titre ou la description
 *     responses:
 *       200:
 *         description: Items récupérés avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/MarketplaceItem' }
 *   post:
 *     tags:
 *       - Marketplace
 *     summary: Publier un item sur la marketplace
 *     description: Permet à un utilisateur de partager un contenu (granule) sur le marché global.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, title]
 *             properties:
 *               type: { type: string, enum: [part, chapter, paragraph, notion] }
 *               title: { type: string }
 *               description: { type: string }
 *               price: { type: number, default: 0 }
 *               content: { type: string, description: "Contenu ou structure JSON" }
 *               category: { type: string }
 *               tags: { type: array, items: { type: string } }
 *     responses:
 *       201:
 *         description: Item publié avec succès
 *       401:
 *         description: Non autorisé
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const type = searchParams.get('type');
        const category = searchParams.get('category');
        const search = searchParams.get('search');

        const where: any = {};

        if (type && type !== 'all') {
            where.type = type;
        }

        if (category) {
            where.category = category;
        }

        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }

        const items = await prisma.marketplaceItem.findMany({
            where,
            orderBy: {
                published_at: "desc",
            },
            include: {
                seller: {
                    select: {
                        user_id: true,
                        firstname: true,
                        lastname: true,
                    },
                },
            },
        });

        return successResponse("Items récupérés avec succès", items);
    } catch (error) {
        console.error("Erreur GET Marketplace:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la récupération des items",
            error instanceof Error ? error.message : undefined
        );
    }
}

/**
 * Handler POST pour publier un item sur la marketplace
 */
export async function POST(request: NextRequest) {
    try {
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Utilisateur non authentifié", undefined, 401);
        }

        const body = await request.json();
        const { type, title, description, price, content, tags, category } = body;

        if (!type || !title) {
            return errorResponse("Type et titre requis", undefined, 400);
        }

        const item = await prisma.marketplaceItem.create({
            data: {
                type,
                title,
                description,
                price: price || 0,
                content,
                tags: tags || [],
                category,
                seller_id: userId,
            },
            include: {
                seller: {
                    select: {
                        user_id: true,
                        firstname: true,
                        lastname: true,
                    },
                },
            },
        });

        return successResponse("Item publié sur la marketplace", item, 201);
    } catch (error) {
        console.error("Erreur POST Marketplace:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la publication",
            error instanceof Error ? error.message : undefined
        );
    }
}
