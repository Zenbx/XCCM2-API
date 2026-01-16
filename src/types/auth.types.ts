/**
 * @fileoverview Types TypeScript pour l'authentification
 * Définit les interfaces pour les utilisateurs, JWT, et les requêtes d'authentification
 */

import type { JWTPayload as JosePayload } from "jose";


/**
 * Interface représentant un utilisateur dans l'application
 */
export interface User {
    user_id: string;
    email: string;
    lastname: string;
    firstname: string;
    org?: string | null;
    occupation?: string | null;
    created_at: Date;
    updated_at: Date;
}

/**
 * Données publiques d'un utilisateur (sans informations sensibles)
 */
export interface PublicUser {
    user_id: string;
    email: string;
    lastname: string;
    firstname: string;
    org?: string | null;
    occupation?: string | null;
    profile_picture?: string | null;
}

/**
 * Payload du JSON Web Token
 */
export interface JWTPayload extends JosePayload {
    userId: string;
    email: string;
}

/**
 * Corps de la requête d'inscription
 */
export interface RegisterRequest {
    email: string;
    password: string;
    password_confirmation: string;
    lastname: string;
    firstname: string;
    org?: string;
    occupation?: string;
}

/**
 * Corps de la requête de connexion
 */
export interface LoginRequest {
    email: string;
    password: string;
    password_confirmation: string;
}

/**
 * Réponse d'authentification avec token
 */
export interface AuthResponse {
    success: boolean;
    message: string;
    data?: {
        user: PublicUser;
        token: string;
    };
}