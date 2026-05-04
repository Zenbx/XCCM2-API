import { describe, it, expect, beforeEach, afterEach } from "vitest";

const REQUIRED = [
    "JWT_SECRET",
    "DATABASE_URL",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
];

describe("checkEnv", () => {
    const original: Record<string, string | undefined> = {};

    beforeEach(() => {
        // Sauvegarder les valeurs originales
        REQUIRED.forEach((key) => {
            original[key] = process.env[key];
            process.env[key] = "test-value";
        });
    });

    afterEach(() => {
        // Restaurer les valeurs originales
        REQUIRED.forEach((key) => {
            if (original[key] === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = original[key];
            }
        });
    });

    it("ne lance pas d'erreur quand toutes les vars sont présentes", async () => {
        const { checkEnv } = await import("@/lib/env-check");
        // Reset le flag interne (module fresh via resetModules dans setup)
        expect(() => checkEnv()).not.toThrow();
    });

    it("lance une erreur si une variable est manquante", async () => {
        delete process.env.JWT_SECRET;
        const { checkEnv } = await import("@/lib/env-check");
        expect(() => checkEnv()).toThrow("JWT_SECRET");
    });

    it("cite toutes les variables manquantes dans le message d'erreur", async () => {
        delete process.env.JWT_SECRET;
        delete process.env.DATABASE_URL;
        const { checkEnv } = await import("@/lib/env-check");
        expect(() => checkEnv()).toThrow(/JWT_SECRET.*DATABASE_URL|DATABASE_URL.*JWT_SECRET/);
    });
});
