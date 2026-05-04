import { describe, it, expect, vi, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";

beforeAll(() => {
    process.env.JWT_SECRET = "test-secret-at-least-32-chars-long!!";
});

vi.mock("@/lib/prisma", () => ({
    default: { user: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/tokenBlacklist", () => ({
    blacklistToken: vi.fn().mockResolvedValue(undefined),
    isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));

import prisma from "@/lib/prisma";
import { isTokenBlacklisted } from "@/lib/tokenBlacklist";
import { POST } from "@/app/api/auth/refresh/route";

const secret = new TextEncoder().encode("test-secret-at-least-32-chars-long!!");

async function makeToken(expiresInSeconds: number) {
    return new SignJWT({ userId: "u1", email: "u@test.io", role: "user" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSeconds)
        .sign(secret);
}

const mockDbUser = {
    user_id: "u1", email: "u@test.io", firstname: "A", lastname: "B",
    org: null, occupation: null, profile_picture: null, role: "user",
    created_at: new Date(), updated_at: new Date(), password: "h",
};

function makeRequest(token: string) {
    return new NextRequest("http://localhost/api/auth/refresh", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
    });
}

describe("POST /api/auth/refresh", () => {
    it("émet un nouveau token si expiration < 24h", async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(mockDbUser as any);
        const token = await makeToken(3600); // expire dans 1h < seuil 24h

        const res = await POST(makeRequest(token));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.token).toBeDefined();
        expect(body.data.token).not.toBe(token);
    });

    it("retourne 425 si le token est encore valide longtemps", async () => {
        const token = await makeToken(48 * 3600); // expire dans 48h > seuil 24h
        const res = await POST(makeRequest(token));
        expect(res.status).toBe(425);
    });

    it("retourne 401 si le token est blacklisté", async () => {
        vi.mocked(isTokenBlacklisted).mockResolvedValue(true);
        const token = await makeToken(3600);
        const res = await POST(makeRequest(token));
        expect(res.status).toBe(401);
    });

    it("retourne 401 sans token", async () => {
        const req = new NextRequest("http://localhost/api/auth/refresh", { method: "POST" });
        const res = await POST(req);
        expect(res.status).toBe(401);
    });
});
