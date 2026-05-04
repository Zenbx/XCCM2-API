import { describe, it, expect } from "vitest";
import {
    successResponse,
    errorResponse,
    validationErrorResponse,
    unauthorizedResponse,
    forbiddenResponse,
    notFoundResponse,
    serverErrorResponse,
} from "@/utils/api-response";

async function json(res: Response) {
    return res.json();
}

describe("successResponse", () => {
    it("retourne status 200 avec success: true", async () => {
        const res = successResponse("OK", { id: 1 });
        expect(res.status).toBe(200);
        const body = await json(res);
        expect(body.success).toBe(true);
        expect(body.message).toBe("OK");
        expect(body.data).toEqual({ id: 1 });
    });

    it("accepte un status personnalisé", async () => {
        const res = successResponse("Créé", { id: 2 }, 201);
        expect(res.status).toBe(201);
    });

    it("n'inclut pas 'data' si non fourni", async () => {
        const res = successResponse("Supprimé");
        const body = await json(res);
        expect(body).not.toHaveProperty("data");
    });
});

describe("errorResponse", () => {
    it("retourne status 400 par défaut avec success: false", async () => {
        const res = errorResponse("Erreur");
        expect(res.status).toBe(400);
        const body = await json(res);
        expect(body.success).toBe(false);
    });

    it("accepte un status et un détail d'erreur", async () => {
        const res = errorResponse("Introuvable", "user not found", 404);
        expect(res.status).toBe(404);
        const body = await json(res);
        expect(body.error).toBe("user not found");
    });
});

describe("validationErrorResponse", () => {
    it("retourne status 422 avec les erreurs par champ", async () => {
        const res = validationErrorResponse({ email: ["Email invalide"] });
        expect(res.status).toBe(422);
        const body = await json(res);
        expect(body.errors.email).toContain("Email invalide");
    });
});

describe("helpers raccourcis", () => {
    it("unauthorizedResponse → 401", async () => {
        expect(unauthorizedResponse().status).toBe(401);
    });
    it("forbiddenResponse → 403", async () => {
        expect(forbiddenResponse().status).toBe(403);
    });
    it("notFoundResponse → 404", async () => {
        expect(notFoundResponse().status).toBe(404);
    });
    it("serverErrorResponse → 500", async () => {
        expect(serverErrorResponse().status).toBe(500);
    });
});
