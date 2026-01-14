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
        .min(1, "L'email est requis")
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
        .min(1, "L'email est requis")
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
        )
        .optional(),

    description: z.string().trim().optional(),
    category: z.string().trim().optional(),
    level: z.string().trim().optional(),
    tags: z.string().trim().optional(),
    author: z.string().trim().optional(),
    language: z.string().trim().optional(),
    is_published: z.boolean().optional(),
    styles: z.any().optional(),
}).refine(
    (data) => Object.keys(data).length > 0,
    {
        message: "Au moins un champ doit être fourni pour la modification",
    }
);

/**
 * Schéma de validation pour la création d'un commentaire
 */
export const createCommentSchema = z.object({
    content: z.string().min(1, "Le commentaire ne peut pas être vide").trim(),
});

/**
 * Type inféré du schéma de création de projet
 */
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

/**
 * Type inféré du schéma de modification de projet
 */
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

// ==========================================
// SCHÉMAS DE VALIDATION POUR LES GRANULES
// ==========================================

/**
 * Schéma de validation pour la création d'une Partie (Part)
 */
export const createPartSchema = z.object({
    part_title: z
        .string()
        .min(3, "Le titre doit contenir au moins 3 caractères")
        .max(200, "Le titre ne peut pas dépasser 200 caractères")
        .trim(),

    part_intro: z
        .string()//.max(1000, "L'introduction ne peut pas dépasser 1000 caractères")
        .trim()
        .optional(),

    part_number: z
        .number()
        .int("Le numéro doit être un entier")
        .positive("Le numéro doit être positif"),
});

/**
 * Schéma de validation pour la modification d'une Partie
 */
export const updatePartSchema = z.object({
    part_title: z
        .string()
        .min(3, "Le titre doit contenir au moins 3 caractères")
        .max(200, "Le titre ne peut pas dépasser 200 caractères")
        .trim()
        .optional(),

    part_intro: z
        .string()//.max(1000, "L'introduction ne peut pas dépasser 1000 caractères")
        .trim()
        .optional(),

    part_number: z
        .number()
        .int("Le numéro doit être un entier")
        .positive("Le numéro doit être positif")
        .optional(),
}).refine(
    (data) => data.part_title || data.part_intro !== undefined || data.part_number,
    {
        message: "Au moins un champ doit être fourni pour la modification",
    }
);

/**
 * Schéma de validation pour la création d'un Chapitre (Chapter)
 */
export const createChapterSchema = z.object({
    chapter_title: z
        .string()
        .min(3, "Le titre doit contenir au moins 3 caractères")
        .max(200, "Le titre ne peut pas dépasser 200 caractères")
        .trim(),

    chapter_number: z
        .number()
        .int("Le numéro doit être un entier")
        .positive("Le numéro doit être positif"),
});

/**
 * Schéma de validation pour la modification d'un Chapitre
 */
export const updateChapterSchema = z.object({
    chapter_title: z
        .string()
        .min(3, "Le titre doit contenir au moins 3 caractères")
        .max(200, "Le titre ne peut pas dépasser 200 caractères")
        .trim()
        .optional(),

    chapter_number: z
        .number()
        .int("Le numéro doit être un entier")
        .positive("Le numéro doit être positif")
        .optional(),
}).refine(
    (data) => data.chapter_title || data.chapter_number,
    {
        message: "Au moins un champ doit être fourni pour la modification",
    }
);

/**
 * Schéma de validation pour la création d'un Paragraphe (Paragraph)
 */
export const createParagraphSchema = z.object({
    para_name: z
        .string()
        .min(3, "Le nom doit contenir au moins 3 caractères")
        .max(200, "Le nom ne peut pas dépasser 200 caractères")
        .trim(),

    para_number: z
        .number()
        .int("Le numéro doit être un entier")
        .positive("Le numéro doit être positif"),
});

/**
 * Schéma de validation pour la modification d'un Paragraphe
 */
export const updateParagraphSchema = z.object({
    para_name: z
        .string()
        .min(3, "Le nom doit contenir au moins 3 caractères")
        .max(200, "Le nom ne peut pas dépasser 200 caractères")
        .trim()
        .optional(),

    para_number: z
        .number()
        .int("Le numéro doit être un entier")
        .positive("Le numéro doit être positif")
        .optional(),
}).refine(
    (data) => data.para_name || data.para_number,
    {
        message: "Au moins un champ doit être fourni pour la modification",
    }
);

/**
 * Schéma de validation pour la création d'une Notion
 */
export const createNotionSchema = z.object({
    notion_name: z
        .string()
        .min(3, "Le nom doit contenir au moins 3 caractères")
        .max(200, "Le nom ne peut pas dépasser 200 caractères")
        .trim(),

    notion_number: z
        .number()
        .int("Le numéro doit être un entier")
        .positive("Le numéro doit être positif"),

    notion_content: z
        .string()
        .min(1, "Le contenu ne peut pas être vide")
        .trim(),
});

/**
 * Schéma de validation pour la modification d'une Notion
 */
export const updateNotionSchema = z.object({
    notion_name: z
        .string()
        .min(3, "Le nom doit contenir au moins 3 caractères")
        .max(200, "Le nom ne peut pas dépasser 200 caractères")
        .trim()
        .optional(),

    notion_number: z
        .number()
        .int("Le numéro doit être un entier")
        .positive("Le numéro doit être positif")
        .optional(),

    notion_content: z
        .string()
        .min(1, "Le contenu ne peut pas être vide")
        .trim()
        .optional(),
}).refine(
    (data) => data.notion_name || data.notion_number || data.notion_content,
    {
        message: "Au moins un champ doit être fourni pour la modification",
    }
);

/**
 * Types inférés des schémas
 */
export type CreatePartInput = z.infer<typeof createPartSchema>;
export type UpdatePartInput = z.infer<typeof updatePartSchema>;
export type CreateChapterInput = z.infer<typeof createChapterSchema>;
export type UpdateChapterInput = z.infer<typeof updateChapterSchema>;
export type CreateParagraphInput = z.infer<typeof createParagraphSchema>;
export type UpdateParagraphInput = z.infer<typeof updateParagraphSchema>;
export type CreateNotionInput = z.infer<typeof createNotionSchema>;
export type UpdateNotionInput = z.infer<typeof updateNotionSchema>;

// ==========================================
// SCHÉMAS DE VALIDATION POUR NEWSLETTER & CONTACT
// ==========================================

/**
 * Schéma de validation pour l'abonnement à la newsletter
 */
export const newsletterSubscribeSchema = z.object({
    email: z
        .string()
        .min(1, "L'email est requis")
        .email("Format d'email invalide")
        .toLowerCase()
        .trim(),
});

/**
 * Schéma de validation pour le formulaire de contact
 */
export const contactSchema = z.object({
    email: z
        .string()
        .min(1, "L'email est requis")
        .email("Format d'email invalide")
        .toLowerCase()
        .trim(),

    name: z
        .string()
        .min(2, "Le nom doit contenir au moins 2 caractères")
        .trim(),

    subject: z
        .string()
        .min(5, "Le sujet doit contenir au moins 5 caractères")
        .max(200, "Le sujet ne peut pas dépasser 200 caractères")
        .trim(),

    message: z
        .string()
        .min(10, "Le message doit contenir au moins 10 caractères")
        .max(5000, "Le message ne peut pas dépasser 5000 caractères")
        .trim(),
});

/**
 * Types inférés pour newsletter et contact
 */
export type NewsletterSubscribeInput = z.infer<typeof newsletterSubscribeSchema>;
export type ContactInput = z.infer<typeof contactSchema>;

// ==========================================
// SCHÉMAS DE VALIDATION POUR INVITATIONS
// ==========================================
 export const sendInvitationSchema = z.object({
     guestEmail: z
         .string()
         .min(1, "L'email est requis")
         .email("Format d'email invalide")
         .toLowerCase()
         .trim(),
 });

 export type SendInvitationInput = z.infer<typeof sendInvitationSchema>;