import { describe, it, expect, vi, beforeAll } from "vitest";
import { NextRequest } from "next/server";

beforeAll(() => {
    process.env.JWT_SECRET = "test-secret-at-least-32-chars-long!!";
});

vi.mock("@/lib/prisma", () => ({
    default: { user: { findUnique: vi.fn(), create: vi.fn() } },
}));
vi.mock("@/lib/rateLimit", () => ({
    rateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 2 }),
    getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));
vi.mock("@/lib/storage", () => ({ saveProfilePicture: vi.fn() }));

import prisma from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { POST } from "@/app/api/auth/register/route";

const validBody = {
    email: "nouveau@test.io",
    password: "Password123!",
    password_confirmation: "Password123!",
    firstname: "Alice",
    lastname: "Martin",
};

function makeRequest(body: object) {
    return new NextRequest("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

describe("POST /api/auth/register", () => {
    it("crée un utilisateur et retourne 201 + token", async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
        vi.mocked(prisma.user.create).mockResolvedValue({
            user_id: "new1", email: validBody.email, password: "hashed",
            firstname: "Alice", lastname: "Martin", org: null, occupation: null,
            profile_picture: null, role: "user",
            created_at: new Date(), updated_at: new Date(),
        } as any);

        const res = await POST(makeRequest(validBody));
        const body = await res.json();

        expect(res.status).toBe(201);
        expect(body.success).toBe(true);
        expect(body.data.token).toBeDefined();
    });

    it("retourne 409 si l'email est déjà utilisé", async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue({ user_id: "existing" } as any);
        const res = await POST(makeRequest(validBody));
        expect(res.status).toBe(409);
    });

    it("retourne 400 si les mots de passe ne correspondent pas", async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
        const res = await POST(makeRequest({ ...validBody, password_confirmation: "Different!" }));
        expect(res.status).toBe(400);
    });

    it("retourne 429 quand le rate limit est atteint", async () => {
        vi.mocked(rateLimit).mockResolvedValue({ allowed: false, remaining: 0, resetInSeconds: 3600 });
        const res = await POST(makeRequest(validBody));
        expect(res.status).toBe(429);
    });

    it("retourne 422 pour un mot de passe trop court (Zod)", async () => {
        vi.mocked(rateLimit).mockResolvedValue({ allowed: true, remaining: 2, resetInSeconds: 3600 });
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
        const res = await POST(makeRequest({ ...validBody, password: "short", password_confirmation: "short" }));
        expect(res.status).toBe(422);
    });
});
