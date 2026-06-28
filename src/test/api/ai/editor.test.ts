import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockGenerateText = vi.hoisted(() => vi.fn());

vi.mock("ai", async (importOriginal) => {
    const actual = await importOriginal<typeof import("ai")>();
    return {
        ...actual,
        generateText: mockGenerateText,
        tool: vi.fn((config) => config),
    };
});
vi.mock("@ai-sdk/mistral", () => ({
    mistral: vi.fn(() => "mistral-mock-model"),
}));

import { POST } from "@/app/api/ai/editor/route";

function makeRequest(body: object) {
    return new Request("http://localhost:3000/api/ai/editor", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MISTRAL_API_KEY;
});

afterEach(() => {
    delete process.env.MISTRAL_API_KEY;
});

describe("POST /api/ai/editor", () => {
    it("retourne 400 si MISTRAL_API_KEY est manquante", async () => {
        const req = makeRequest({
            messages: [{ role: "user", content: "Crée un cours" }],
            context: {},
        });
        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toMatch(/MISTRAL_API_KEY/);
    });

    it("retourne 200 avec le texte généré", async () => {
        process.env.MISTRAL_API_KEY = "test-key";
        mockGenerateText.mockResolvedValue({
            text: "Voici la structure créée",
            toolCalls: [],
            steps: [],
        });

        const req = makeRequest({
            messages: [{ role: "user", content: "Crée un cours sur Python" }],
            context: { projectName: "Python Course" },
        });
        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.text).toBe("Voici la structure créée");
        expect(data.actions).toEqual([]);
    });

    it("extrait les tool calls depuis les steps (input AI SDK v6)", async () => {
        process.env.MISTRAL_API_KEY = "test-key";
        mockGenerateText.mockResolvedValue({
            text: "",
            toolCalls: [],
            steps: [
                {
                    toolCalls: [
                        {
                            toolName: "create_structure",
                            input: {
                                parts: [{
                                    title: "Introduction",
                                    chapters: [{
                                        title: "Ch 1",
                                        paragraphs: [{
                                            title: "P1",
                                            notions: [{ title: "N1", content: "<p>x</p>" }],
                                        }],
                                    }],
                                }],
                            },
                        },
                    ],
                },
            ],
        });

        const req = makeRequest({
            messages: [{ role: "user", content: "Crée une structure" }],
            context: {},
        });
        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.actions).toHaveLength(1);
        expect(data.actions[0].type).toBe("create_structure");
        expect(data.actions[0].data.parts[0].title).toBe("Introduction");
    });

    it("déduplique les tool calls entre steps et toolCalls racine", async () => {
        process.env.MISTRAL_API_KEY = "test-key";
        const tc = { toolName: "write_content", input: { content: "text", target: "current" } };
        mockGenerateText.mockResolvedValue({
            text: "OK",
            toolCalls: [tc],
            steps: [{ toolCalls: [tc] }],
        });

        const req = makeRequest({
            messages: [{ role: "user", content: "Écris" }],
            context: {},
        });
        const res = await POST(req);
        const data = await res.json();

        expect(data.actions).toHaveLength(1);
    });

    it("retourne 500 si generateText throw", async () => {
        process.env.MISTRAL_API_KEY = "test-key";
        mockGenerateText.mockRejectedValue(new Error("Mistral error"));

        const req = makeRequest({
            messages: [{ role: "user", content: "test" }],
            context: {},
        });
        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(500);
        expect(data.error).toMatch(/Mistral error/);
    });
});
