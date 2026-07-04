import Redis from 'ioredis';

function createRedisClient(): Redis {
    const url = process.env.REDIS_URL;
    const common = {
        maxRetriesPerRequest: 1,
        connectTimeout: 1000,
        lazyConnect: true,
    };

    if (url) {
        return new Redis(url, common);
    }

    return new Redis({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: Number(process.env.REDIS_PORT || 6379),
        password: process.env.REDIS_PASSWORD || undefined,
        ...common,
    });
}

const client = createRedisClient();

let consecutiveErrors = 0;
const MAX_ERRORS = 3;
let lastErrorTime = 0;
const ERROR_COOLDOWN = 60000;

const redisWrapper = {
    async get(key: string): Promise<string | null> {
        if (consecutiveErrors >= MAX_ERRORS && Date.now() - lastErrorTime < ERROR_COOLDOWN) {
            return null;
        }

        try {
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Redis Timeout')), 1000)
            );
            const result = await Promise.race([client.get(key), timeoutPromise]);
            consecutiveErrors = 0;
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
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Redis Timeout')), 1000)
            );

            const command =
                mode === 'EX' && duration
                    ? client.set(key, value, 'EX', duration)
                    : client.set(key, value);

            await Promise.race([command, timeoutPromise]);
            consecutiveErrors = 0;
            return 'OK';
        } catch (error) {
            this.handleError(error);
            return null;
        }
    },

    async del(...keys: string[]): Promise<number> {
        if (keys.length === 0) return 0;

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

    handleError(error: unknown) {
        consecutiveErrors++;
        lastErrorTime = Date.now();
        const message = error instanceof Error ? error.message : String(error);
        console.error(`⚠️ Redis Error (${consecutiveErrors}/${MAX_ERRORS}):`, message);

        if (consecutiveErrors === MAX_ERRORS) {
            console.error('🚫 Redis Circuit Breaker: Cache disabled for 1 minute.');
        }
    },

    on(event: string, callback: () => void) {
        if (event === 'connect') callback();
        return this;
    },
};

export default redisWrapper;
