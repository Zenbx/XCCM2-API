/**
 * Vérifie au démarrage que les variables d'environnement critiques sont définies.
 * Stockage : Supabase (cloud) OU MinIO (datacenter / Docker).
 */

const REQUIRED_CORE = ["JWT_SECRET", "DATABASE_URL"] as const;

const MINIO_VARS = [
    "MINIO_ENDPOINT",
    "MINIO_ACCESS_KEY",
    "MINIO_SECRET_KEY",
    "MINIO_PUBLIC_URL",
] as const;

const SUPABASE_VARS = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;

const PRODUCTION_EXTRA = ["REDIS_PASSWORD"] as const;

let checked = false;

export function checkEnv(): void {
    if (checked) return;
    checked = true;

    const missingCore = REQUIRED_CORE.filter((key) => !process.env[key]);
    if (missingCore.length > 0) {
        throw new Error(
            `Variables d'environnement manquantes : ${missingCore.join(", ")}. ` +
                `Vérifiez votre fichier .env ou la configuration du serveur.`
        );
    }

    const hasSupabase = SUPABASE_VARS.every((key) => !!process.env[key]);
    const hasMinio = MINIO_VARS.every((key) => !!process.env[key]);

    if (!hasSupabase && !hasMinio) {
        throw new Error(
            "Stockage non configuré : définissez SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY " +
                "(Vercel) OU MINIO_ENDPOINT + MINIO_ACCESS_KEY + MINIO_SECRET_KEY + MINIO_PUBLIC_URL " +
                "(datacenter / Docker)."
        );
    }

    if (process.env.NODE_ENV === "production") {
        const missingProd = PRODUCTION_EXTRA.filter((key) => !process.env[key]);
        // REDIS_PASSWORD optionnel si REDIS_URL complet (Upstash)
        if (
            missingProd.length > 0 &&
            !process.env.REDIS_URL &&
            !process.env.UPSTASH_REDIS_REST_URL
        ) {
            console.warn(
                `[env-check] Avertissement production : ${missingProd.join(", ")} absent(s). ` +
                    `Rate-limit / cache peuvent être dégradés.`
            );
        }
    }
}
