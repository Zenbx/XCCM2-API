/**
 * @fileoverview Instance singleton du client Prisma
 * Gère la connexion unique à la base de données MongoDB
 * Évite les connexions multiples en développement avec le Hot Module Replacement
 */
import { PrismaClient } from "@prisma/client";

/**
 * Extension du global pour TypeScript
 * Permet de stocker l'instance Prisma globalement en développement
 */
declare global {
    // eslint-disable-next-line no-var
    var prisma: PrismaClient | undefined;
}

/**
 * Instance unique du client Prisma
 * En développement: utilise une instance globale pour éviter les reconnexions
 * En production: crée une nouvelle instance
 */
const prisma = global.prisma || new PrismaClient();

// En développement, stocke l'instance globalement
if (process.env.NODE_ENV !== "production") {
    console.log("Environnement actuel :", process.env.NODE_ENV);
    global.prisma = prisma;
}

export default prisma;
