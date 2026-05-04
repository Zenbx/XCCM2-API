import { describe, it, expect, vi, beforeAll } from "vitest";
import { NextRequest } from "next/server";

beforeAll(() => {
    process.env.JWT_SECRET = "test-secret-at-least-32-chars-long!!";
});

vi.mock("@/lib/tokenBlacklist", () => ({
    blacklistToken: vi.fn().mockResolvedValue(undefined),
}));

import { blacklistToken } from "@/lib/tokenBlacklist";
import { generateToken, toPublicUser } from "@/lib/auth";
import { POST } from "@/app/api/auth/logout/route";

const mockPublicUser = {
    user_id: "u1", email: "user@test.io", firstname: "A", lastname: "B",
    org: null, occupation: null, profile_picture: null, role: "user",
    created_at: new Date(),
};

describe("POST /api/auth/logout", () => {
    it("blackliste le token et retourne 200", async () => {
        const token = await generateToken(mockPublicUser);
        const req = new NextRequest("http://localhost/api/auth/logout", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
        });

        const res = await POST(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(blacklistToken).toHaveBeenCalledWith(token, expect.any(Number));
    });

    it("retourne 200 même sans token (déconnexion déjà effective)", async () => {
        const req = new NextRequest("http://localhost/api/auth/logout", {
            method: "POST",
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
        expect(blacklistToken).not.toHaveBeenCalled();
    });
});
