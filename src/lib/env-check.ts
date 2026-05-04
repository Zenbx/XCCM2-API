/**
 * Vérifie au démarrage que toutes les variables d'environnement critiques sont définies.
 * À appeler dans les routes ou au bootstrap — Next.js ne fournit pas de hook global.
 * Lève une Error explicite plutôt qu'un crash cryptique en production.
 */

const REQUIRED_ENV_VARS = [
    "JWT_SECRET",
    "DATABASE_URL",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
] as const;

let checked = false;

export function checkEnv(): void {
    if (checked) return;
    checked = true;

    const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(
            `Variables d'environnement manquantes : ${missing.join(", ")}. ` +
            `Vérifiez votre fichier .env ou la configuration Vercel/Railway.`
        );
    }
}
