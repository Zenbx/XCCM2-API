import redis from '@/lib/redis';

/**
 * Service de gestion du cache Redis
 * Note: Upstash REST SDK gère la sérialisation automatiquement
 */
class CacheService {
    /**
     * Récupère une valeur du cache
     */
    async get<T>(key: string): Promise<T | null> {
        try {
            const data = await redis.get(key);
            if (!data) return null;
            // Upstash désérialise automatiquement, pas besoin de JSON.parse
            return data as T;
        } catch (error) {
            console.error(`Error getting cache key ${key}:`, error);
            return null;
        }
    }

    /**
     * Stocke une valeur dans le cache
     * @param key Clé
     * @param value Valeur
     * @param ttl Temps de vie en secondes (défaut 1h)
     */
    async set(key: string, value: any, ttl: number = 3600): Promise<void> {
        try {
            // Upstash sérialise automatiquement, pas besoin de JSON.stringify
            await redis.set(key, value, 'EX', ttl);
        } catch (error) {
            console.error(`Error setting cache key ${key}:`, error);
        }
    }

    /**
     * Supprime une clé du cache
     */
    async del(key: string): Promise<void> {
        try {
            await redis.del(key);
        } catch (error) {
            console.error(`Error deleting cache key ${key}:`, error);
        }
    }

    /**
     * Supprime plusieurs clés correspondant à un pattern
     * Utile pour l'invalidation (ex: "projects:*")
     */
    async delByPattern(pattern: string): Promise<void> {
        try {
            const keys = await redis.keys(pattern);
            if (keys.length > 0) {
                await redis.del(...keys);
            }
        } catch (error) {
            console.error(`Error deleting cache pattern ${pattern}:`, error);
        }
    }
}

export const cacheService = new CacheService();
