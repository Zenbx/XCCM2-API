/**
 * @fileoverview Types TypeScript pour les projets
 * Définit les interfaces pour les projets et leurs requêtes
 */

/**
 * Interface représentant un projet dans l'application
 */
export interface Project {
    pr_id: string;
    pr_name: string;
    owner_id: string;
    created_at: Date;
    updated_at: Date;
}

/**
 * Projet avec les informations du propriétaire
 */
export interface ProjectWithOwner extends Project {
    owner: {
        user_id: string;
        email: string;
        firstname: string;
        lastname: string;
    };
}

/**
 * Corps de la requête de création de projet
 */
export interface CreateProjectRequest {
    pr_name: string;
}

/**
 * Corps de la requête de modification de projet
 */
export interface UpdateProjectRequest {
    pr_name: string;
}

/**
 * Paramètres pour identifier un projet par nom et owner
 */
export interface ProjectIdentifier {
    pr_name: string;
    owner_id: string;
}