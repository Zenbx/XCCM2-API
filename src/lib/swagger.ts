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
        ],
    },
    apis: ["./src/app/api/**/*.ts"], // Chemins vers les fichiers contenant les annotations JSDoc
};

/**
 * Spécification OpenAPI générée
 */
export const swaggerSpec = swaggerJSDoc(swaggerOptions);