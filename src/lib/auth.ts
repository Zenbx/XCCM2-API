/**
 * @fileoverview Fonctions utilitaires pour l'authentification
 * Gère le hachage des mots de passe, la création et vérification des JWT
 */

import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import type { JWTPayload, PublicUser } from "@/types/auth.types";

/**
 * Nombre de rounds pour le hachage bcrypt (10 = bon compromis sécurité/performance)
 */
const SALT_ROUNDS = 10;

/**
 * Secret JWT depuis les variables d'environnement
 */
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_change_me";

/**
 * Durée de validité du JWT
 */
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

/**
 * Hache un mot de passe avec bcrypt
 * @param password - Mot de passe en clair
 * @returns Promise du mot de passe haché
 */
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare un mot de passe en clair avec un hash
 * @param password - Mot de passe en clair
 * @param hashedPassword - Mot de passe haché
 * @returns Promise<boolean> - true si le mot de passe correspond
 */
export async function verifyPassword(
    password: string,
    hashedPassword: string
): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
}

/**
 * Génère un token JWT pour un utilisateur
 * @param user - Utilisateur pour lequel générer le token
 * @returns Token JWT signé
 */
export function generateToken(user: PublicUser): string {
    const payload: JWTPayload = {
        userId: user.user_id,
        email: user.email,
    };

    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN as SignOptions["expiresIn"],
    });
}

/**
 * Vérifie et décode un token JWT
 * @param token - Token JWT à vérifier
 * @returns Payload décodé ou null si invalide
 */
export function verifyToken(token: string): JWTPayload | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
        return decoded;
    } catch (error) {
        return null;
    }
}

/**
 * Extrait le token du header Authorization
 * @param authHeader - Header Authorization (format: "Bearer <token>")
 * @returns Token extrait ou null
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return null;
    }
    return authHeader.substring(7);
}

/**
 * Convertit un utilisateur Prisma en PublicUser (sans le mot de passe)
 * @param user - Utilisateur complet de la base de données
 * @returns Utilisateur sans informations sensibles
 */
export function toPublicUser(user: {
    user_id: string;
    email: string;
    lastname: string;
    firstname: string;
    org: string | null;
    occupation: string | null;
    created_at: Date;
    updated_at: Date;
}): PublicUser {
    return {
        user_id: user.user_id,
        email: user.email,
        lastname: user.lastname,
        firstname: user.firstname,
        org: user.org,
        occupation: user.occupation,
    };
}