import redis from "@/lib/redis";

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetInSeconds: number;
}

/**
 * Rate limiter basé sur Upstash Redis (sliding window via INCR + EXPIRE).
 * Utilise le circuit breaker existant dans redis.ts — si Redis est indisponible
 * le rate limit est bypassé (fail open) pour ne pas bloquer les utilisateurs légitimes.
 *
 * @param key       Clé unique (ex: "rl:login:127.0.0.1")
 * @param limit     Nombre max de requêtes autorisées
 * @param windowSec Durée de la fenêtre en secondes
 */
export async function rateLimit(
    key: string,
    limit: number,
    windowSec: number
): Promise<RateLimitResult> {
    const redisKey = `rl:${key}`;

    try {
        const current = await redis.get(redisKey);
        const count = current ? parseInt(current, 10) : 0;

        if (count >= limit) {
            return { allowed: false, remaining: 0, resetInSeconds: windowSec };
        }

        const newCount = count + 1;
        await redis.set(redisKey, String(newCount), "EX", windowSec);

        return {
            allowed: true,
            remaining: limit - newCount,
            resetInSeconds: windowSec,
        };
    } catch {
        // Fail open : Redis indisponible → on laisse passer
        return { allowed: true, remaining: 1, resetInSeconds: windowSec };
    }
}

/**
 * Extrait l'IP réelle depuis les headers (Vercel, Railway, proxies)
 */
export function getClientIp(request: Request): string {
    return (
        (request.headers as any).get?.("x-real-ip") ||
        (request.headers as any).get?.("x-forwarded-for")?.split(",")[0]?.trim() ||
        "unknown"
    );
}
