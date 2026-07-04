/**
 * Vérifie au démarrage que toutes les variables d'environnement critiques sont définies.
 */

const REQUIRED_ENV_VARS = [
    "JWT_SECRET",
    "DATABASE_URL",
    "MINIO_ENDPOINT",
    "MINIO_ACCESS_KEY",
    "MINIO_SECRET_KEY",
    "MINIO_PUBLIC_URL",
] as const;

const PRODUCTION_EXTRA = ["REDIS_PASSWORD"] as const;

let checked = false;

export function checkEnv(): void {
    if (checked) return;
    checked = true;

    const required = [...REQUIRED_ENV_VARS];
    if (process.env.NODE_ENV === "production") {
        required.push(...PRODUCTION_EXTRA);
    }

    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(
            `Variables d'environnement manquantes : ${missing.join(", ")}. ` +
            `Vérifiez votre fichier .env ou la configuration du serveur.`
        );
    }
}
