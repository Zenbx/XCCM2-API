import { vi, afterEach } from "vitest";

// Variables d'environnement requises par auth.ts au niveau module
process.env.JWT_SECRET = "test-secret-at-least-32-chars-long!!";
process.env.JWT_EXPIRES_IN = "7d";
process.env.DATABASE_URL = "mongodb://localhost:27017/test";
process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
process.env.CLOUDINARY_API_KEY = "test-key";
process.env.CLOUDINARY_API_SECRET = "test-secret";

// Reset tous les mocks après chaque test
afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
});
