import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma, mockCacheService } = vi.hoisted(() => ({
    mockPrisma: {
        project: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            create: vi.fn(),
            delete: vi.fn(),
        },
        invitation: {
            findMany: vi.fn(),
        },
    },
    mockCacheService: {
        get: vi.fn(),
        set: vi.fn(),
        del: vi.fn(),
    },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/services/cache-service", () => ({ cacheService: mockCacheService }));

import { GET, POST } from "@/app/api/projects/route";

function makeGet(headers: Record<string, string> = {}) {
    return new NextRequest("http://localhost:3000/api/projects", { headers });
}

function makePost(body: object, headers: Record<string, string> = {}) {
    return new NextRequest("http://localhost:3000/api/projects", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json", ...headers },
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    mockCacheService.get.mockResolvedValue(null);
    mockCacheService.set.mockResolvedValue(undefined);
    mockCacheService.del.mockResolvedValue(undefined);
});

describe("GET /api/projects", () => {
    it("retourne 401 si x-user-id manquant", async () => {
        const res = await GET(makeGet());
        expect(res.status).toBe(401);
    });

    it("retourne les projets depuis le cache (cache hit)", async () => {
        const cachedData = { projects: [{ pr_id: "p1", pr_name: "Cached" }], count: 1 };
        mockCacheService.get.mockResolvedValue(cachedData);

        const res = await GET(makeGet({ "x-user-id": "user-1" }));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.data.count).toBe(1);
        expect(mockPrisma.project.findMany).not.toHaveBeenCalled();
    });

    it("requête prisma sur cache miss et met en cache le résultat", async () => {
        const project = { pr_id: "p1", pr_name: "Mine", owner_id: "user-1", documents: [] };
        mockPrisma.project.findMany.mockResolvedValue([project]);
        mockPrisma.invitation.findMany.mockResolvedValue([]);

        const res = await GET(makeGet({ "x-user-id": "user-1" }));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.data.count).toBe(1);
        expect(data.data.projects[0].user_role).toBe("OWNER");
        expect(mockCacheService.set).toHaveBeenCalled();
    });

    it("fusionne les projets owned et invited", async () => {
        const ownedProject = { pr_id: "p1", pr_name: "Mine", owner_id: "user-1", documents: [] };
        const invitedProject = {
            pr_id: "p2",
            pr_name: "Invited",
            documents: [],
            owner: { firstname: "Alice", lastname: "B", email: "alice@x.com" },
        };
        mockPrisma.project.findMany.mockResolvedValue([ownedProject]);
        mockPrisma.invitation.findMany.mockResolvedValue([
            {
                inv_id: "inv-1",
                role: "EDITOR",
                invitation_state: "Accepted",
                invitation_token: "token-1",
                project: invitedProject,
            },
        ]);

        const res = await GET(makeGet({ "x-user-id": "user-1" }));
        const data = await res.json();

        expect(data.data.count).toBe(2);
        expect(data.data.projects[1].user_role).toBe("EDITOR");
    });
});

describe("POST /api/projects", () => {
    it("retourne 401 si x-user-id manquant", async () => {
        const res = await POST(makePost({ pr_name: "My Project" }));
        expect(res.status).toBe(401);
    });

    it("crée un projet et retourne 201", async () => {
        mockPrisma.project.findUnique.mockResolvedValue(null);
        const created = { pr_id: "p-new", pr_name: "New Project", owner_id: "user-1" };
        mockPrisma.project.create.mockResolvedValue(created);

        const res = await POST(makePost({ pr_name: "New Project" }, { "x-user-id": "user-1" }));
        const data = await res.json();

        expect(res.status).toBe(201);
        expect(data.data.project.pr_name).toBe("New Project");
        expect(mockCacheService.del).toHaveBeenCalled();
    });

    it("retourne 409 si le projet existe déjà (sans overwrite)", async () => {
        mockPrisma.project.findUnique.mockResolvedValue({ pr_id: "existing" });

        const res = await POST(makePost({ pr_name: "Existing Project" }, { "x-user-id": "user-1" }));
        expect(res.status).toBe(409);
    });

    it("écrase le projet existant si overwrite: true", async () => {
        mockPrisma.project.findUnique.mockResolvedValue({ pr_id: "old-id" });
        mockPrisma.project.delete.mockResolvedValue({});
        mockPrisma.project.create.mockResolvedValue({ pr_id: "new-id", pr_name: "Same Name", owner_id: "user-1" });

        const res = await POST(makePost({ pr_name: "Same Name", overwrite: true }, { "x-user-id": "user-1" }));

        expect(res.status).toBe(201);
        expect(mockPrisma.project.delete).toHaveBeenCalledWith({ where: { pr_id: "old-id" } });
    });

    it("retourne 422 sur erreur de validation Zod", async () => {
        const res = await POST(makePost({ pr_name: "AB" }, { "x-user-id": "user-1" }));
        expect(res.status).toBe(422);
    });
});
