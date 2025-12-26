/**
 * @fileoverview Schémas de validation avec Zod
 * Définit les règles de validation pour toutes les entrées utilisateur
 */

import { z } from "zod";

/**
 * Schéma de validation pour l'inscription d'un utilisateur
 */
export const registerSchema = z.object({
    email: z
        .string()
        .min(1,"L'email est requis")
        .email("Format d'email invalide")
        .toLowerCase()
        .trim(),

    password: z
        .string()
        .min(8, "Le mot de passe doit contenir au moins 8 caractères")
        .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
            "Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre"
        ),

    lastname: z
        .string()
        .min(2, "Le nom doit contenir au moins 2 caractères")
        .trim(),

    firstname: z
        .string()
        .min(2, "Le prénom doit contenir au moins 2 caractères")
        .trim(),

    org: z.string().trim().optional(),

    occupation: z.string().trim().optional(),
});

/**
 * Schéma de validation pour la connexion d'un utilisateur
 */
export const loginSchema = z.object({
    email: z
        .string()
        .min(1,"L'email est requis")
        .email("Format d'email invalide")
        .toLowerCase()
        .trim(),

    password: z
        .string()
        .min(6, "Le mot de passe doit avoir au moins 6 caractères"),
});

/**
 * Type inféré du schéma d'inscription
 */
export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Type inféré du schéma de connexion
 */
export type LoginInput = z.infer<typeof loginSchema>;