import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/rateLimit", () => ({
    rateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 19 }),
}));
vi.mock("cloudinary", () => ({
    v2: {
        config: vi.fn(),
        uploader: {
            upload_stream: vi.fn((_, cb) => {
                const stream = { end: vi.fn() };
                setTimeout(() => cb(null, { secure_url: "https://res.cloudinary.com/test.jpg", public_id: "test", format: "jpg", bytes: 1024 }), 0);
                return stream;
            }),
        },
    },
}));

import { rateLimit } from "@/lib/rateLimit";
import { POST } from "@/app/api/upload/route";

function makePngBuffer(): Buffer {
    // PNG magic bytes: 0x89 0x50 0x4E 0x47 ...
    return Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ...Array(100).fill(0)]);
}

function makeJpegBuffer(): Buffer {
    // JPEG magic bytes: 0xFF 0xD8 0xFF
    return Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, ...Array(100).fill(0)]);
}

function makeExeBuffer(): Buffer {
    // EXE magic bytes: 0x4D 0x5A (MZ header)
    return Buffer.from([0x4D, 0x5A, ...Array(100).fill(0)]);
}

async function makeFormDataRequest(file: File, userId = "u1") {
    const formData = new FormData();
    formData.append("file", file);
    return new NextRequest("http://localhost/api/upload", {
        method: "POST",
        headers: { "x-user-id": userId },
        body: formData,
    });
}

describe("POST /api/upload", () => {
    it("refuse si l'utilisateur n'est pas authentifié", async () => {
        const req = new NextRequest("http://localhost/api/upload", { method: "POST" });
        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it("retourne 429 si le rate limit upload est atteint", async () => {
        vi.mocked(rateLimit).mockResolvedValue({ allowed: false, remaining: 0, resetInSeconds: 3600 });
        const req = new NextRequest("http://localhost/api/upload", {
            method: "POST",
            headers: { "x-user-id": "u1" },
            body: new FormData(),
        });
        const res = await POST(req);
        expect(res.status).toBe(429);
    });

    it("refuse un fichier sans magic bytes valides (spoofing)", async () => {
        vi.mocked(rateLimit).mockResolvedValue({ allowed: true, remaining: 19, resetInSeconds: 3600 });
        const fakeFile = new File([makeExeBuffer()], "virus.jpg", { type: "image/jpeg" });
        const req = await makeFormDataRequest(fakeFile);
        const res = await POST(req);
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body.message).toMatch(/contenu.*format|format.*contenu/i);
    });

    it("refuse un fichier trop volumineux", async () => {
        vi.mocked(rateLimit).mockResolvedValue({ allowed: true, remaining: 19, resetInSeconds: 3600 });
        const bigBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
        bigBuffer[0] = 0xFF; bigBuffer[1] = 0xD8; bigBuffer[2] = 0xFF; // JPEG magic
        const bigFile = new File([bigBuffer], "big.jpg", { type: "image/jpeg" });
        const req = await makeFormDataRequest(bigFile);
        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it("refuse un type MIME non supporté", async () => {
        vi.mocked(rateLimit).mockResolvedValue({ allowed: true, remaining: 19, resetInSeconds: 3600 });
        const file = new File([makeExeBuffer()], "script.exe", { type: "application/octet-stream" });
        const req = await makeFormDataRequest(file);
        const res = await POST(req);
        expect(res.status).toBe(400);
    });
});
