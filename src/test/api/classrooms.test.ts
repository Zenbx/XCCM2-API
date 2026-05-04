import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        classroom: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn(),
        },
        enrollment: {
            findMany: vi.fn(),
        },
    },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("crypto", () => ({
    default: {
        randomBytes: vi.fn(() => ({ toString: () => "abc123" })),
    },
    randomBytes: vi.fn(() => ({ toString: () => "abc123" })),
}));

import { GET, POST } from "@/app/api/classrooms/route";

beforeEach(() => {
    vi.clearAllMocks();
    // generateUniqueJoinCode: findUnique returns null → code is unique on first try
    mockPrisma.classroom.findUnique.mockResolvedValue(null);
});

describe("GET /api/classrooms", () => {
    it("retourne 401 si x-user-id manquant", async () => {
        const req = new NextRequest("http://localhost:3000/api/classrooms");
        const res = await GET(req);
        expect(res.status).toBe(401);
    });

    it("retourne teaching et enrolled séparément", async () => {
        const teachingClass = {
            cl_id: "cl-1",
            name: "Math 101",
            teacher_id: "user-1",
            _count: { enrollments: 5, projects: 2 },
        };
        const enrollment = {
            student_id: "user-1",
            enrolled_at: new Date(),
            classroom: {
                cl_id: "cl-2",
                name: "Physics 101",
                teacher: { firstname: "Alice", lastname: "B", email: "alice@x.com" },
                _count: { projects: 3 },
            },
        };

        mockPrisma.classroom.findMany.mockResolvedValue([teachingClass]);
        mockPrisma.enrollment.findMany.mockResolvedValue([enrollment]);

        const req = new NextRequest("http://localhost:3000/api/classrooms", {
            headers: { "x-user-id": "user-1" },
        });
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.data.teaching).toHaveLength(1);
        expect(data.data.teaching[0].name).toBe("Math 101");
        expect(data.data.enrolled).toHaveLength(1);
        expect(data.data.enrolled[0].name).toBe("Physics 101");
    });

    it("retourne des listes vides si aucune classe", async () => {
        mockPrisma.classroom.findMany.mockResolvedValue([]);
        mockPrisma.enrollment.findMany.mockResolvedValue([]);

        const req = new NextRequest("http://localhost:3000/api/classrooms", {
            headers: { "x-user-id": "user-1" },
        });
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.data.teaching).toHaveLength(0);
        expect(data.data.enrolled).toHaveLength(0);
    });
});

describe("POST /api/classrooms", () => {
    it("retourne 401 si x-user-id manquant", async () => {
        const req = new NextRequest("http://localhost:3000/api/classrooms", {
            method: "POST",
            body: JSON.stringify({ name: "New Class" }),
            headers: { "Content-Type": "application/json" },
        });
        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it("crée une classe avec un code d'invitation et retourne 201", async () => {
        const newClassroom = {
            cl_id: "cl-new",
            name: "New Class",
            join_code: "ABC123",
            teacher_id: "user-1",
            description: null,
            created_at: new Date(),
        };
        mockPrisma.classroom.create.mockResolvedValue(newClassroom);

        const req = new NextRequest("http://localhost:3000/api/classrooms", {
            method: "POST",
            body: JSON.stringify({ name: "New Class" }),
            headers: { "Content-Type": "application/json", "x-user-id": "user-1" },
        });
        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(201);
        expect(data.data.classroom.name).toBe("New Class");
        expect(data.data.classroom.join_code).toBe("ABC123");
    });

    it("retourne 422 si name trop court", async () => {
        const req = new NextRequest("http://localhost:3000/api/classrooms", {
            method: "POST",
            body: JSON.stringify({ name: "X" }), // min 3 chars
            headers: { "Content-Type": "application/json", "x-user-id": "user-1" },
        });
        const res = await POST(req);
        expect(res.status).toBe(422);
    });

    it("réessaie la génération du code si le premier est déjà pris", async () => {
        // First findUnique: code taken → loop again; second: null → unique
        mockPrisma.classroom.findUnique
            .mockResolvedValueOnce({ cl_id: "existing", join_code: "ABC123" })
            .mockResolvedValueOnce(null);

        const newClassroom = { cl_id: "cl-new", name: "Retry Class", join_code: "ABC123" };
        mockPrisma.classroom.create.mockResolvedValue(newClassroom);

        const req = new NextRequest("http://localhost:3000/api/classrooms", {
            method: "POST",
            body: JSON.stringify({ name: "Retry Class" }),
            headers: { "Content-Type": "application/json", "x-user-id": "user-1" },
        });
        const res = await POST(req);

        expect(res.status).toBe(201);
        expect(mockPrisma.classroom.findUnique).toHaveBeenCalledTimes(2);
    });
});
