import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/jwt-edge", () => ({
    verifyToken: vi.fn(),
    extractTokenFromHeader: vi.fn(),
}));

import { middleware } from "@/middleware";
import * as jwtEdge from "@/lib/jwt-edge";

const extractTokenFromHeader = vi.mocked(jwtEdge.extractTokenFromHeader);
const verifyToken = vi.mocked(jwtEdge.verifyToken);

function makeRequest(path: string, options: { method?: string; headers?: Record<string, string> } = {}) {
    return new NextRequest(`http://localhost:3000${path}`, {
        method: options.method ?? "GET",
        headers: options.headers ?? {},
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    extractTokenFromHeader.mockReturnValue(null);
    verifyToken.mockResolvedValue(null);
});

describe("middleware — CORS preflight", () => {
    it("répond 200 aux requêtes OPTIONS", async () => {
        const req = makeRequest("/api/projects", { method: "OPTIONS", headers: { origin: "http://localhost:3001" } });
        const res = await middleware(req);
        expect(res.status).toBe(200);
    });

    it("inclut les headers CORS sur la réponse OPTIONS", async () => {
        const req = makeRequest("/api/projects", { method: "OPTIONS", headers: { origin: "http://localhost:3001" } });
        const res = await middleware(req);
        expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3001");
        expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    });

    it("rejette les origines non whitelistées", async () => {
        const req = makeRequest("/api/projects", { method: "OPTIONS", headers: { origin: "https://evil.com" } });
        const res = await middleware(req);
        expect(res.headers.get("Access-Control-Allow-Origin")).not.toBe("https://evil.com");
    });
});

describe("middleware — routes publiques", () => {
    it("laisse passer /api/auth/login sans token", async () => {
        const req = makeRequest("/api/auth/login", { method: "POST" });
        const res = await middleware(req);
        expect(res.status).not.toBe(401);
    });

    it("laisse passer /api/auth/register sans token", async () => {
        const req = makeRequest("/api/auth/register", { method: "POST" });
        const res = await middleware(req);
        expect(res.status).not.toBe(401);
    });

    it("laisse passer /api/health sans token", async () => {
        const req = makeRequest("/api/health");
        const res = await middleware(req);
        expect(res.status).not.toBe(401);
    });
});

describe("middleware — protection JWT", () => {
    it("retourne 401 si pas de token sur route protégée", async () => {
        extractTokenFromHeader.mockReturnValue(null);
        const req = makeRequest("/api/projects");
        const res = await middleware(req);
        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.message).toMatch(/Token manquant/);
    });

    it("retourne 401 si token invalide ou expiré", async () => {
        extractTokenFromHeader.mockReturnValue("invalid.token");
        verifyToken.mockResolvedValue(null);

        const req = makeRequest("/api/projects", { headers: { Authorization: "Bearer invalid.token" } });
        const res = await middleware(req);
        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.message).toMatch(/invalide|expiré/);
    });

    it("laisse passer avec un token valide", async () => {
        extractTokenFromHeader.mockReturnValue("valid.token");
        verifyToken.mockResolvedValue({ userId: "user-123", role: "user" });

        const req = makeRequest("/api/projects", { headers: { Authorization: "Bearer valid.token" } });
        const res = await middleware(req);
        expect(res.status).not.toBe(401);
    });
});

describe("middleware — headers de sécurité", () => {
    it("applique X-Frame-Options: DENY sur les réponses API", async () => {
        extractTokenFromHeader.mockReturnValue("valid.token");
        verifyToken.mockResolvedValue({ userId: "user-1", role: "user" });

        const req = makeRequest("/api/projects", { headers: { Authorization: "Bearer valid.token" } });
        const res = await middleware(req);
        expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    });

    it("applique X-Content-Type-Options: nosniff", async () => {
        extractTokenFromHeader.mockReturnValue("valid.token");
        verifyToken.mockResolvedValue({ userId: "user-1", role: "user" });

        const req = makeRequest("/api/projects", { headers: { Authorization: "Bearer valid.token" } });
        const res = await middleware(req);
        expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    });

    it("applique les headers de sécurité sur les routes publiques", async () => {
        const req = makeRequest("/api/auth/login", { method: "POST" });
        const res = await middleware(req);
        expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    });

    it("applique les headers CORS sur les réponses 401", async () => {
        extractTokenFromHeader.mockReturnValue(null);
        const req = makeRequest("/api/projects", { headers: { origin: "http://localhost:3001" } });
        const res = await middleware(req);
        expect(res.status).toBe(401);
        expect(res.headers.get("Access-Control-Allow-Origin")).toBeTruthy();
    });
});
