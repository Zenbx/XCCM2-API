import { describe, it, expect, beforeAll } from "vitest";
import {
    hashPassword,
    verifyPassword,
    generateToken,
    verifyToken,
    extractTokenFromHeader,
    toPublicUser,
} from "@/lib/auth";

beforeAll(() => {
    process.env.JWT_SECRET = "test-secret-at-least-32-chars-long!!";
    process.env.JWT_EXPIRES_IN = "7d";
});

const mockUser = {
    user_id: "abc123",
    email: "test@xccm.io",
    lastname: "Dupont",
    firstname: "Marie",
    org: "XCCM",
    occupation: "Teacher",
    profile_picture: null,
    role: "user",
    created_at: new Date("2025-01-01"),
    updated_at: new Date("2025-01-01"),
};

describe("hashPassword / verifyPassword", () => {
    it("hash un mot de passe et le vérifie correctement", async () => {
        const hash = await hashPassword("MonMotDePasse123!");
        expect(hash).not.toBe("MonMotDePasse123!");
        expect(await verifyPassword("MonMotDePasse123!", hash)).toBe(true);
    });

    it("retourne false pour un mauvais mot de passe", async () => {
        const hash = await hashPassword("CorrectPassword");
        expect(await verifyPassword("WrongPassword", hash)).toBe(false);
    });
});

describe("generateToken / verifyToken", () => {
    it("génère un token valide et le vérifie", async () => {
        const publicUser = toPublicUser(mockUser);
        const token = await generateToken(publicUser);
        expect(typeof token).toBe("string");
        expect(token.split(".")).toHaveLength(3); // Header.Payload.Signature

        const payload = await verifyToken(token);
        expect(payload).not.toBeNull();
        expect((payload as any).userId).toBe("abc123");
        expect((payload as any).email).toBe("test@xccm.io");
        expect((payload as any).role).toBe("user");
    });

    it("retourne null pour un token invalide", async () => {
        const result = await verifyToken("not.a.valid.token");
        expect(result).toBeNull();
    });

    it("retourne null pour un token avec une signature altérée", async () => {
        const publicUser = toPublicUser(mockUser);
        const token = await generateToken(publicUser);
        const tampered = token.slice(0, -5) + "XXXXX";
        expect(await verifyToken(tampered)).toBeNull();
    });
});

describe("extractTokenFromHeader", () => {
    it("extrait correctement le token du header Bearer", () => {
        expect(extractTokenFromHeader("Bearer mytoken123")).toBe("mytoken123");
    });

    it("retourne null si le header est null", () => {
        expect(extractTokenFromHeader(null)).toBeNull();
    });

    it("retourne null si le format n'est pas Bearer", () => {
        expect(extractTokenFromHeader("Basic credentials")).toBeNull();
        expect(extractTokenFromHeader("mytoken123")).toBeNull();
    });
});

describe("toPublicUser", () => {
    it("exclut les champs sensibles", () => {
        const result = toPublicUser(mockUser);
        expect(result).not.toHaveProperty("password");
        expect(result).not.toHaveProperty("updated_at");
        expect(result.user_id).toBe("abc123");
        expect(result.email).toBe("test@xccm.io");
    });

    it("utilise 'user' comme rôle par défaut si non spécifié", () => {
        const { role, ...userWithoutRole } = mockUser;
        const result = toPublicUser(userWithoutRole as any);
        expect(result.role).toBe("user");
    });
});
