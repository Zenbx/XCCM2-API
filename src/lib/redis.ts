import { Redis } from '@upstash/redis';

// Upstash REST API (plus fiable que ioredis pour Upstash)
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// Wrapper pour maintenir la compatibilité avec ioredis
const redisWrapper = {
    async get(key: string): Promise<string | null> {
        try {
            return await redis.get(key);
        } catch (error) {
            console.error(`Error getting key ${key}:`, error);
            return null;
        }
    },

    async set(key: string, value: string, mode?: string, duration?: number): Promise<string | null> {
        try {
            if (mode === 'EX' && duration) {
                await redis.set(key, value, { ex: duration });
            } else {
                await redis.set(key, value);
            }
            return 'OK';
        } catch (error) {
            console.error(`Error setting key ${key}:`, error);
            return null;
        }
    },

    async del(...keys: string[]): Promise<number> {
        try {
            return await redis.del(...keys);
        } catch (error) {
            console.error(`Error deleting keys:`, error);
            return 0;
        }
    },

    async keys(pattern: string): Promise<string[]> {
        try {
            return await redis.keys(pattern);
        } catch (error) {
            console.error(`Error getting keys with pattern ${pattern}:`, error);
            return [];
        }
    },

    // Méthodes factices pour la compatibilité avec les events listeners
    on(event: string, callback: Function) {
        if (event === 'connect') {
            console.log('✅ Connected to Upstash Redis (REST)');
            callback();
        }
        return this;
    },
};

export default redisWrapper;
