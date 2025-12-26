/**
 * @fileoverview Types TypeScript pour les réponses API standardisées
 * Définit les structures de réponses communes à toute l'application
 */

/**
 * Réponse API générique avec succès
 */
export interface ApiSuccessResponse<T = unknown> {
    success: true;
    message: string;
    data?: T;
}

/**
 * Réponse API générique avec erreur
 */
export interface ApiErrorResponse {
    success: false;
    message: string;
    error?: string;
    errors?: Record<string, string[]>;
}

/**
 * Union type pour toutes les réponses API
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Options pour la pagination
 */
export interface PaginationOptions {
    page: number;
    limit: number;
}

/**
 * Métadonnées de pagination
 */
export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

/**
 * Réponse paginée
 */
export interface PaginatedResponse<T> {
    success: true;
    message: string;
    data: T[];
    meta: PaginationMeta;
}