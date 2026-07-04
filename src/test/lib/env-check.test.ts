import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const REQUIRED = [
    "JWT_SECRET",
    "DATABASE_URL",
    "MINIO_ENDPOINT",
    "MINIO_ACCESS_KEY",
    "MINIO_SECRET_KEY",
    "MINIO_PUBLIC_URL",
];

describe("checkEnv", () => {
    const original: Record<string, string | undefined> = {};

    beforeEach(() => {
        vi.resetModules();
        REQUIRED.forEach((key) => {
            original[key] = process.env[key];
            process.env[key] = "test-value";
        });
        process.env.NODE_ENV = "test";
    });

    afterEach(() => {
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
