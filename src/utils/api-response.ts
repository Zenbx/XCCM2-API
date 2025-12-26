/**
 * @fileoverview Helpers pour les réponses API standardisées
 * Fournit des fonctions utilitaires pour créer des réponses HTTP cohérentes
 */

import { NextResponse } from "next/server";
import type { ApiSuccessResponse, ApiErrorResponse } from "@/types/api.types";

/**
 * Crée une réponse de succès standardisée
 * @param message - Message de succès
 * @param data - Données à retourner (optionnel)
 * @param status - Code de statut HTTP (défaut: 200)
 * @returns NextResponse avec le format standardisé
 */
export function successResponse<T>(
    message: string,
    data?: T,
    status: number = 200
): NextResponse<ApiSuccessResponse<T>> {
    return NextResponse.json(
        {
            success: true,
            message,
            ...(data !== undefined && { data }),
        },
        { status }
    );
}

/**
 * Crée une réponse d'erreur standardisée
 * @param message - Message d'erreur principal
 * @param error - Détails de l'erreur (optionnel)
 * @param status - Code de statut HTTP (défaut: 400)
 * @returns NextResponse avec le format d'erreur standardisé
 */
export function errorResponse(
    message: string,
    error?: string,
    status: number = 400
): NextResponse<ApiErrorResponse> {
    return NextResponse.json(
        {
            success: false,
            message,
            ...(error && { error }),
        },
        { status }
    );
}

/**
 * Crée une réponse d'erreur de validation avec détails
 * @param errors - Objet contenant les erreurs de validation par champ
 * @param message - Message d'erreur général (défaut: "Erreur de validation")
 * @returns NextResponse avec les erreurs de validation
 */
export function validationErrorResponse(
    errors: Record<string, string[]>,
    message: string = "Erreur de validation"
): NextResponse<ApiErrorResponse> {
    return NextResponse.json(
        {
            success: false,
            message,
            errors,
        },
        { status: 422 }
    );
}

/**
 * Crée une réponse d'erreur non autorisée (401)
 * @param message - Message d'erreur (défaut: "Non autorisé")
 * @returns NextResponse avec statut 401
 */
export function unauthorizedResponse(
    message: string = "Non autorisé"
): NextResponse<ApiErrorResponse> {
    return errorResponse(message, undefined, 401);
}

/**
 * Crée une réponse d'erreur interdite (403)
 * @param message - Message d'erreur (défaut: "Accès interdit")
 * @returns NextResponse avec statut 403
 */
export function forbiddenResponse(
    message: string = "Accès interdit"
): NextResponse<ApiErrorResponse> {
    return errorResponse(message, undefined, 403);
}

/**
 * Crée une réponse d'erreur ressource non trouvée (404)
 * @param message - Message d'erreur (défaut: "Ressource non trouvée")
 * @returns NextResponse avec statut 404
 */
export function notFoundResponse(
    message: string = "Ressource non trouvée"
): NextResponse<ApiErrorResponse> {
    return errorResponse(message, undefined, 404);
}

/**
 * Crée une réponse d'erreur serveur (500)
 * @param message - Message d'erreur (défaut: "Erreur interne du serveur")
 * @param error - Détails de l'erreur
 * @returns NextResponse avec statut 500
 */
export function serverErrorResponse(
    message: string = "Erreur interne du serveur",
    error?: string
): NextResponse<ApiErrorResponse> {
    return errorResponse(message, error, 500);
}