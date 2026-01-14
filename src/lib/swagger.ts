/**
 * @fileoverview Configuration de Swagger pour la documentation API
 * Définit les métadonnées OpenAPI et génère la spécification
 */

import swaggerJSDoc from "swagger-jsdoc";

/**
 * Options de configuration Swagger/OpenAPI
 */
const swaggerOptions: swaggerJSDoc.Options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "XCCM API Documentation",
            version: "1.0.0",
            description: `
        API REST pour la plateforme XCCM (Cross-Cultural Content Management).
        
        ## Authentification
        La plupart des endpoints nécessitent un token JWT.
        Ajoutez le header: \`Authorization: Bearer <votre_token>\`
        
        ## Fonctionnalités principales
        - Gestion des utilisateurs et authentification
        - Gestion des projets collaboratifs
        - Gestion des documents et contenus
        - Système de likes et d'invitations
      `,
            contact: {
                name: "Support XCCM",
                email: "support@xccm.com",
            },
            license: {
                name: "MIT",
                url: "https://opensource.org/licenses/MIT",
            },
        },
        servers: [
            {
                url: "http://localhost:3000",
                description: "Serveur de développement",
            },
            {
                url: "https://api.xccm.com",
                description: "Serveur de production",
            },
        ],
        // AJOUT DES TAGS
        tags: [
            {
                name: "Authentication",
                description: "Endpoints d'authentification et gestion de session",
            },
            {
                name: "Projects",
                description: "Gestion des projets collaboratifs",
            },
            {
                name: "Health",
                description: "Endpoints de santé de l'API",
            },
            {
                name: "Parts",
                description: "Gestion des parties (granules de niveau 1)",
            },
            {
                name: "Chapters",
                description: "Gestion des chapitres (granules de niveau 2)",
            },
            {
                name: "Paragraphs",
                description: "Gestion des paragraphes (granules de niveau 3)",
            },
            {
                name: "Notions",
                description: "Gestion des notions (granules de niveau 4)",
            },
            // TAG POUR LES DOCUMENTS
            {
                name: "Documents",
                description: "Gestion des documents PDF (téléchargement, génération)",
            },
        ],
        // CONFIGURATION D'AUTHENTIFICATION GLOBALE
        security: [
            {
                bearerAuth: [], // Applique l'authentification à tous les endpoints par défaut
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                    description: "Entrez votre token JWT",
                },
            },
            schemas: {
                User: {
                    type: "object",
                    properties: {
                        user_id: {
                            type: "string",
                            description: "ID unique de l'utilisateur (MongoDB ObjectId)",
                        },
                        email: {
                            type: "string",
                            format: "email",
                            description: "Adresse email de l'utilisateur",
                        },
                        lastname: {
                            type: "string",
                            description: "Nom de famille",
                        },
                        firstname: {
                            type: "string",
                            description: "Prénom",
                        },
                        org: {
                            type: "string",
                            nullable: true,
                            description: "Organisation de l'utilisateur",
                        },
                        occupation: {
                            type: "string",
                            nullable: true,
                            description: "Métier/Occupation",
                        },
                    },
                },
                ApiSuccess: {
                    type: "object",
                    properties: {
                        success: {
                            type: "boolean",
                            example: true,
                        },
                        message: {
                            type: "string",
                            example: "Opération réussie",
                        },
                        data: {
                            type: "object",
                            description: "Données retournées",
                        },
                    },
                },
                ApiError: {
                    type: "object",
                    properties: {
                        success: {
                            type: "boolean",
                            example: false,
                        },
                        message: {
                            type: "string",
                            example: "Une erreur s'est produite",
                        },
                        error: {
                            type: "string",
                            description: "Détails de l'erreur",
                        },
                        errors: {
                            type: "object",
                            description: "Erreurs de validation par champ",
                            additionalProperties: {
                                type: "array",
                                items: {
                                    type: "string",
                                },
                            },
                        },
                    },
                },
                Project: {
                    type: "object",
                    properties: {
                        pr_id: {
                            type: "string",
                            description: "ID unique du projet (MongoDB ObjectId)",
                        },
                        pr_name: {
                            type: "string",
                            description: "Nom du projet",
                            example: "Mon Super Projet",
                        },
                        owner_id: {
                            type: "string",
                            description: "ID du propriétaire du projet",
                        },
                        created_at: {
                            type: "string",
                            format: "date-time",
                            description: "Date de création du projet",
                        },
                        updated_at: {
                            type: "string",
                            format: "date-time",
                            description: "Date de dernière modification",
                        },
                    },
                },
                ProjectWithOwner: {
                    type: "object",
                    properties: {
                        pr_id: {
                            type: "string",
                            description: "ID unique du projet",
                        },
                        pr_name: {
                            type: "string",
                            description: "Nom du projet",
                        },
                        owner_id: {
                            type: "string",
                            description: "ID du propriétaire",
                        },
                        created_at: {
                            type: "string",
                            format: "date-time",
                        },
                        updated_at: {
                            type: "string",
                            format: "date-time",
                        },
                        owner: {
                            type: "object",
                            properties: {
                                user_id: { type: "string" },
                                email: { type: "string" },
                                firstname: { type: "string" },
                                lastname: { type: "string" },
                            },
                        },
                    },
                },
                Part: {
                    type: "object",
                    properties: {
                        part_id: {
                            type: "string",
                            description: "ID unique de la partie",
                        },
                        part_title: {
                            type: "string",
                            description: "Titre de la partie",
                            example: "Introduction",
                        },
                        part_intro: {
                            type: "string",
                            nullable: true,
                            description: "Introduction de la partie (optionnel)",
                        },
                        part_number: {
                            type: "integer",
                            description: "Numéro de la partie",
                            example: 1,
                        },
                        parent_pr: {
                            type: "string",
                            description: "ID du projet parent",
                        },
                    },
                },
                Chapter: {
                    type: "object",
                    properties: {
                        chapter_id: {
                            type: "string",
                            description: "ID unique du chapitre",
                        },
                        chapter_title: {
                            type: "string",
                            description: "Titre du chapitre",
                            example: "Contexte historique",
                        },
                        chapter_number: {
                            type: "integer",
                            description: "Numéro du chapitre",
                            example: 1,
                        },
                        parent_part: {
                            type: "string",
                            description: "ID de la partie parente",
                        },
                    },
                },
                Paragraph: {
                    type: "object",
                    properties: {
                        para_id: {
                            type: "string",
                            description: "ID unique du paragraphe",
                        },
                        para_name: {
                            type: "string",
                            description: "Nom du paragraphe",
                            example: "Définitions",
                        },
                        para_number: {
                            type: "integer",
                            description: "Numéro du paragraphe",
                            example: 1,
                        },
                        parent_chapter: {
                            type: "string",
                            description: "ID du chapitre parent",
                        },
                    },
                },
                Notion: {
                    type: "object",
                    properties: {
                        notion_id: {
                            type: "string",
                            description: "ID unique de la notion",
                        },
                        notion_name: {
                            type: "string",
                            description: "Nom de la notion",
                            example: "Concept de base",
                        },
                        notion_content: {
                            type: "string",
                            description: "Contenu de la notion",
                            example: "Le contenu détaillé de la notion...",
                        },
                        parent_para: {
                            type: "string",
                            description: "ID du paragraphe parent",
                        },
                    },
                },
                // AJOUT DU SCHÉMA POUR LES DOCUMENTS
                Document: {
                    type: "object",
                    properties: {
                        document_id: {
                            type: "string",
                            description: "ID unique du document",
                        },
                        name: {
                            type: "string",
                            description: "Nom du document",
                        },
                        file_path: {
                            type: "string",
                            description: "Chemin du fichier dans Supabase",
                        },
                        mime_type: {
                            type: "string",
                            description: "Type MIME du fichier",
                            example: "application/pdf",
                        },
                        size: {
                            type: "integer",
                            description: "Taille du fichier en octets",
                        },
                        created_at: {
                            type: "string",
                            format: "date-time",
                            description: "Date de création",
                        },
                    },
                },
            },
        },
        // Remplacer la section tags pour y ajouter Projects :
        tags: [
            {
                name: "Authentication",
                description: "Endpoints d'authentification et gestion de session",
            },
            {
                name: "Projects",
                description: "Gestion des projets collaboratifs",
            },
            {
                name: "Health",
                description: "Endpoints de santé de l'API",
            },
            {
                name: "Parts",
                description: "Gestion des parties (granules de niveau 1)",
            },
            {
                name: "Chapters",
                description: "Gestion des chapitres (granules de niveau 2)",
            },
            {
                name: "Paragraphs",
                description: "Gestion des paragraphes (granules de niveau 3)",
            },
            {
                name: "Notions",
                description: "Gestion des notions (granules de niveau 4)",
            },
            {
                name: "Invitations",
                description: "Gestion des invitations de collaboration",
            },
        ],
    },
    apis: ["./src/app/api/**/*.ts"], // Chemins vers les fichiers contenant les annotations JSDoc
};

// Fonction pour générer la spécification dynamiquement
export function generateSwaggerSpec() {
    return swaggerJSDoc(swaggerOptions);
}

// Export des options pour usage interne
export { swaggerOptions };

// Note: Nous n'exportons plus swaggerSpec directement car
// il doit être généré au runtime dans app/api/docs/route.ts