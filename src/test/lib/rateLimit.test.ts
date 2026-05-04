import { describe, it, expect, vi, beforeEach } from "vitest";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

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

describe("rateLimit", () => {
    it("autorise la première requête", async () => {
        vi.mocked(redis.get).mockResolvedValue(null);
        const result = await rateLimit("login:127.0.0.1", 5, 900);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4);
    });

    it("autorise jusqu'à la limite", async () => {
        vi.mocked(redis.get).mockResolvedValue("4");
        const result = await rateLimit("login:127.0.0.1", 5, 900);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(0);
    });

    it("bloque quand la limite est atteinte", async () => {
        vi.mocked(redis.get).mockResolvedValue("5");
        const result = await rateLimit("login:127.0.0.1", 5, 900);
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
    });

    it("fail open si Redis est indisponible", async () => {
        vi.mocked(redis.get).mockRejectedValue(new Error("Redis down"));
        const result = await rateLimit("login:127.0.0.1", 5, 900);
        expect(result.allowed).toBe(true);
    });
});

describe("getClientIp", () => {
    it("extrait l'IP depuis x-real-ip", () => {
        const req = new Request("http://localhost/api/test", {
            headers: { "x-real-ip": "192.168.1.1" },
        });
        expect(getClientIp(req)).toBe("192.168.1.1");
    });

    it("extrait la première IP depuis x-forwarded-for", () => {
        const req = new Request("http://localhost/api/test", {
            headers: { "x-forwarded-for": "10.0.0.1, 10.0.0.2" },
        });
        expect(getClientIp(req)).toBe("10.0.0.1");
    });

    it("retourne 'unknown' si aucun header IP présent", () => {
        const req = new Request("http://localhost/api/test");
        expect(getClientIp(req)).toBe("unknown");
    });
});
