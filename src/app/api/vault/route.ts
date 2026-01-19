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
 * Handler GET pour récupérer tous les éléments du coffre-fort de l'utilisateur
 */
export async function GET(request: NextRequest) {
    try {
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Utilisateur non authentifié", undefined, 401);
        }

        const vaultItems = await prisma.vaultItem.findMany({
            where: {
                owner_id: userId,
            },
            orderBy: {
                added_at: "desc",
            },
        });

        return successResponse("Éléments du coffre-fort récupérés", vaultItems);
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
