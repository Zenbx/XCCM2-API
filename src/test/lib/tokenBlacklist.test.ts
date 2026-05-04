import { describe, it, expect, vi, beforeEach } from "vitest";
import { blacklistToken, isTokenBlacklisted } from "@/lib/tokenBlacklist";

vi.mock("@/lib/redis", () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
    },
}));

import redis from "@/lib/redis";

beforeEach(() => {
    vi.mocked(redis.get).mockResolvedValue(null);
    vi.mocked(redis.set).mockResolvedValue("OK");
});

describe("blacklistToken", () => {
    it("stocke le token dans Redis avec le bon TTL", async () => {
        const token = "my.jwt.token";
        const futureExp = Math.floor(Date.now() / 1000) + 3600; // expire dans 1h

        await blacklistToken(token, futureExp);

        expect(redis.set).toHaveBeenCalledWith(
            `blacklist:jwt:${token}`,
            "1",
            "EX",
            expect.any(Number)
        );
        const ttlArg = vi.mocked(redis.set).mock.calls[0][3] as number;
        expect(ttlArg).toBeGreaterThan(3500);
        expect(ttlArg).toBeLessThanOrEqual(3600);
    });

    it("ne stocke pas un token déjà expiré", async () => {
        const pastExp = Math.floor(Date.now() / 1000) - 10;
        await blacklistToken("expired.token", pastExp);
        expect(redis.set).not.toHaveBeenCalled();
    });
});

describe("isTokenBlacklisted", () => {
    it("retourne true si le token est dans Redis", async () => {
        vi.mocked(redis.get).mockResolvedValue("1");
        const result = await isTokenBlacklisted("blacklisted.token");
        expect(result).toBe(true);
    });

    it("retourne false si le token n'est pas dans Redis", async () => {
        vi.mocked(redis.get).mockResolvedValue(null);
        const result = await isTokenBlacklisted("valid.token");
        expect(result).toBe(false);
    });
});
