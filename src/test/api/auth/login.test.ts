import { describe, it, expect, vi, beforeAll } from "vitest";
import { NextRequest } from "next/server";

beforeAll(() => {
    process.env.JWT_SECRET = "test-secret-at-least-32-chars-long!!";
    process.env.JWT_EXPIRES_IN = "7d";
});

vi.mock("@/lib/prisma", () => ({
    default: { user: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/rateLimit", () => ({
    rateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 4 }),
    getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));
vi.mock("@/lib/env-check", () => ({ checkEnv: vi.fn() }));

import prisma from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { hashPassword } from "@/lib/auth";
import { POST } from "@/app/api/auth/login/route";

function makeRequest(body: object) {
    return new NextRequest("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

describe("POST /api/auth/login", () => {
    it("retourne 200 + token avec des credentials valides", async () => {
        const hash = await hashPassword("Password123!");
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            user_id: "u1", email: "user@test.io", password: hash,
            firstname: "Jean", lastname: "Bon", org: null, occupation: null,
            profile_picture: null, role: "user",
            created_at: new Date(), updated_at: new Date(),
        } as any);

        const res = await POST(makeRequest({ email: "user@test.io", password: "Password123!" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.data.token).toBeDefined();
        expect(body.data.user.email).toBe("user@test.io");
    });

    it("retourne 401 si l'utilisateur n'existe pas", async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
        const res = await POST(makeRequest({ email: "nobody@test.io", password: "Password123!" }));
        expect(res.status).toBe(401);
    });

    it("retourne 401 si le mot de passe est incorrect", async () => {
        const hash = await hashPassword("CorrectPassword123!");
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            user_id: "u1", email: "user@test.io", password: hash,
            firstname: "J", lastname: "B", org: null, occupation: null,
            profile_picture: null, role: "user",
            created_at: new Date(), updated_at: new Date(),
        } as any);

        const res = await POST(makeRequest({ email: "user@test.io", password: "WrongPassword!" }));
        expect(res.status).toBe(401);
    });

    it("retourne 429 quand le rate limit est atteint", async () => {
        vi.mocked(rateLimit).mockResolvedValue({ allowed: false, remaining: 0, resetInSeconds: 900 });
        const res = await POST(makeRequest({ email: "user@test.io", password: "Password123!" }));
        expect(res.status).toBe(429);
    });

    it("retourne 422 pour un email invalide (Zod)", async () => {
        vi.mocked(rateLimit).mockResolvedValue({ allowed: true, remaining: 4, resetInSeconds: 900 });
        const res = await POST(makeRequest({ email: "not-an-email", password: "Password123!" }));
        expect(res.status).toBe(422);
    });
});
