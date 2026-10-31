import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const CORE = ["JWT_SECRET", "DATABASE_URL"] as const;

const MINIO = [
    "MINIO_ENDPOINT",
    "MINIO_ACCESS_KEY",
    "MINIO_SECRET_KEY",
    "MINIO_PUBLIC_URL",
] as const;

const SUPABASE = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;

describe("checkEnv", () => {
    const original: Record<string, string | undefined> = {};
    const ALL = [...CORE, ...MINIO, ...SUPABASE];

    beforeEach(() => {
        vi.resetModules();
        ALL.forEach((key) => {
            original[key] = process.env[key];
            delete process.env[key];
        });
        process.env.NODE_ENV = "test";
        process.env.JWT_SECRET = "test-value";
        process.env.DATABASE_URL = "test-value";
        // Par défaut : MinIO (comme Docker local)
        MINIO.forEach((key) => {
            process.env[key] = "test-value";
        });
    });

    afterEach(() => {
        ALL.forEach((key) => {
            if (original[key] === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = original[key];
            }
        });
    });

    it("ne lance pas d'erreur avec MinIO seul", async () => {
        const { checkEnv } = await import("@/lib/env-check");
        expect(() => checkEnv()).not.toThrow();
    });

    it("ne lance pas d'erreur avec Supabase seul (sans MinIO)", async () => {
        MINIO.forEach((key) => delete process.env[key]);
        SUPABASE.forEach((key) => {
            process.env[key] = "test-value";
        });
        const { checkEnv } = await import("@/lib/env-check");
        expect(() => checkEnv()).not.toThrow();
    });

    it("lance une erreur si JWT_SECRET manque", async () => {
        delete process.env.JWT_SECRET;
        const { checkEnv } = await import("@/lib/env-check");
        expect(() => checkEnv()).toThrow("JWT_SECRET");
    });

    it("lance une erreur si ni Supabase ni MinIO", async () => {
        MINIO.forEach((key) => delete process.env[key]);
        const { checkEnv } = await import("@/lib/env-check");
        expect(() => checkEnv()).toThrow(/Stockage non configuré/);
    });

    it("cite toutes les variables core manquantes", async () => {
        delete process.env.JWT_SECRET;
        delete process.env.DATABASE_URL;
        const { checkEnv } = await import("@/lib/env-check");
        expect(() => checkEnv()).toThrow(
            /JWT_SECRET.*DATABASE_URL|DATABASE_URL.*JWT_SECRET/
        );
    });
});
