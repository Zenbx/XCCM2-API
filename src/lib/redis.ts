import { Redis } from '@upstash/redis';

// Upstash REST API (plus fiable que ioredis pour Upstash)
// Upstash REST API
const client = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// État du Circuit Breaker
let consecutiveErrors = 0;
const MAX_ERRORS = 3;
let lastErrorTime = 0;
const ERROR_COOLDOWN = 60000; // 1 minute avant de retenter

const redisWrapper = {
    async get(key: string): Promise<string | null> {
        if (consecutiveErrors >= MAX_ERRORS && Date.now() - lastErrorTime < ERROR_COOLDOWN) {
            return null; // Circuit ouvert
        }

        try {
            // On utilise une Promise.race pour le timeout car @upstash/redis ne le gère pas nativement
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Redis Timeout')), 1000)
            );

            const result = await Promise.race([client.get(key), timeoutPromise]) as string | null;
            consecutiveErrors = 0; // Reset on success
            return result;
        } catch (error) {
            this.handleError(error);
            return null;
        }
    },

    async set(key: string, value: string, mode?: string, duration?: number): Promise<string | null> {
        if (consecutiveErrors >= MAX_ERRORS && Date.now() - lastErrorTime < ERROR_COOLDOWN) {
            return null;
        }

        try {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Redis Timeout')), 1000)
            );

            if (mode === 'EX' && duration) {
                await Promise.race([client.set(key, value, { ex: duration }), timeoutPromise]);
            } else {
                await Promise.race([client.set(key, value), timeoutPromise]);
            }
            consecutiveErrors = 0;
            return 'OK';
        } catch (error) {
            this.handleError(error);
            return null;
        }
    },

    async del(...keys: string[]): Promise<number> {
        try {
            const result = await client.del(...keys);
            consecutiveErrors = 0;
            return result;
        } catch (error) {
            this.handleError(error);
            return 0;
        }
    },

    async keys(pattern: string): Promise<string[]> {
        try {
            const result = await client.keys(pattern);
            consecutiveErrors = 0;
            return result;
        } catch (error) {
            this.handleError(error);
            return [];
        }
    },

    handleError(error: any) {
        consecutiveErrors++;
        lastErrorTime = Date.now();
        console.error(`⚠️ Redis Error (${consecutiveErrors}/${MAX_ERRORS}):`, error.message || error);

        if (consecutiveErrors === MAX_ERRORS) {
            console.error('🚫 Redis Circuit Breaker: Cache disabled for 1 minute.');
        }
    },

    on(event: string, callback: Function) {
        if (event === 'connect') callback();
        return this;
    },
};

export default redisWrapper;
