/**
 * @fileoverview Fonctions utilitaires pour l'authentification
 * Gère le hachage des mots de passe, la création et vérification des JWT avec jose
 */

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
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
 * Durée de validité du JWT (par défaut 7 jours)
 */
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

/**
 * Convertit la clé secrète en Uint8Array pour jose
 */
const getSecretKey = () => new TextEncoder().encode(JWT_SECRET);

/**
 * Convertit la durée (ex: "7d", "24h") en secondes
 * @param duration - Durée au format string (ex: "7d", "24h", "60m")
 * @returns Nombre de secondes
 */
function parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60; // Par défaut 7 jours

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
        case "s":
            return value;
        case "m":
            return value * 60;
        case "h":
            return value * 60 * 60;
        case "d":
            return value * 24 * 60 * 60;
        default:
            return 7 * 24 * 60 * 60;
    }
}

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
 * Génère un token JWT pour un utilisateur avec jose
 * @param user - Utilisateur pour lequel générer le token
 * @returns Promise du token JWT signé
 */
export async function generateToken(user: PublicUser): Promise<string> {
    const payload: JWTPayload = {
        userId: user.user_id,
        email: user.email,
    };

    const expiresInSeconds = parseDuration(JWT_EXPIRES_IN);

    const token = await new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSeconds)
        .sign(getSecretKey());

    return token;
}

/**
 * Vérifie et décode un token JWT avec jose
 * @param token - Token JWT à vérifier
 * @returns Promise du payload décodé ou null si invalide
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
    try {
        const { payload } = await jwtVerify(token, getSecretKey(), {
            algorithms: ["HS256"],
        });

        return payload as JWTPayload;
    } catch (error) {
        console.error("Erreur de vérification du token:", error);
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
    profile_picture: string | null;
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
        profile_picture: user.profile_picture,
    };
}