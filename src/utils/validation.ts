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

/**
 * Schéma de validation pour la création d'un projet
 */
export const createProjectSchema = z.object({
    pr_name: z
        .string()
        .min(3, "Le nom du projet doit contenir au moins 3 caractères")
        .max(100, "Le nom du projet ne peut pas dépasser 100 caractères")
        .trim()
        .regex(
            /^[a-zA-Z0-9\s\-_àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ]+$/,
            "Le nom du projet ne peut contenir que des lettres, chiffres, espaces, tirets et underscores"
        ),
});

/**
 * Schéma de validation pour la modification d'un projet
 */
export const updateProjectSchema = z.object({
    pr_name: z
        .string()
        .min(3, "Le nom du projet doit contenir au moins 3 caractères")
        .max(100, "Le nom du projet ne peut pas dépasser 100 caractères")
        .trim()
        .regex(
            /^[a-zA-Z0-9\s\-_àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ]+$/,
            "Le nom du projet ne peut contenir que des lettres, chiffres, espaces, tirets et underscores"
        ),
});

/**
 * Type inféré du schéma de création de projet
 */
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

/**
 * Type inféré du schéma de modification de projet
 */
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;