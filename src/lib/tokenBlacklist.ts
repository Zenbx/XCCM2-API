import redis from "@/lib/redis";

const PREFIX = "blacklist:jwt:";

/**
 * Ajoute un token JWT à la blacklist Redis jusqu'à son expiration naturelle.
 * @param token     Le token JWT brut (string)
 * @param expiresAt Timestamp Unix (secondes) d'expiration du token
 */
export async function blacklistToken(token: string, expiresAt: number): Promise<void> {
    const ttl = expiresAt - Math.floor(Date.now() / 1000);
    if (ttl <= 0) return; // Déjà expiré, inutile de le stocker
    await redis.set(`${PREFIX}${token}`, "1", "EX", ttl);
}

/**
 * Vérifie si un token est dans la blacklist.
 * @returns true si le token est révoqué (doit être rejeté)
 */
export async function isTokenBlacklisted(token: string): Promise<boolean> {
    const result = await redis.get(`${PREFIX}${token}`);
    return result !== null;
}
