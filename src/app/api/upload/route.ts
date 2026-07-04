/**
 * @openapi
 * /api/upload:
 *   post:
 *     tags:
 *       - Upload
 *     summary: Uploader un fichier vers MinIO
 *     description: |
 *       Upload d'un fichier (PDF, JPEG, PNG, WEBP). Valide le MIME type, les magic bytes et la taille (max 10 Mo).
 *       Rate-limitée à 20 uploads/heure par utilisateur.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Fichier uploadé avec succès
 *       400:
 *         description: Format non supporté ou taille dépassée
 *       401:
 *         description: Non authentifié
 *       429:
 *         description: Limite d'upload atteinte (20/h)
 *       500:
 *         description: Erreur stockage
 */
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { successResponse, errorResponse, serverErrorResponse } from "@/utils/api-response";
import { rateLimit } from "@/lib/rateLimit";
import { uploadObject, UPLOADS_BUCKET } from "@/lib/object-storage";

const MAGIC_BYTES: Record<string, number[][]> = {
    "image/jpeg": [[0xFF, 0xD8, 0xFF]],
    "image/png": [[0x89, 0x50, 0x4E, 0x47]],
    "image/webp": [[0x52, 0x49, 0x46, 0x46]],
    "application/pdf": [[0x25, 0x50, 0x44, 0x46]],
};

function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
    const signatures = MAGIC_BYTES[mimeType];
    if (!signatures) return false;
    return signatures.some((sig) =>
        sig.every((byte, i) => buffer[i] === byte)
    );
}

function sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export async function POST(request: NextRequest) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Utilisateur non authentifié", undefined, 401);

        const rl = await rateLimit(`upload:${userId}`, 20, 60 * 60);
        if (!rl.allowed) {
            return errorResponse("Limite d'upload atteinte. Réessayez dans 1 heure.", undefined, 429);
        }

        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) return errorResponse("Aucun fichier fourni");

        const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
        const maxSize = 10 * 1024 * 1024;

        if (!allowedTypes.includes(file.type)) {
            return errorResponse("Format non supporté. Formats acceptés : PDF, JPEG, PNG, WEBP");
        }

        if (file.size > maxSize) {
            return errorResponse("Le fichier dépasse la taille maximale autorisée (10 Mo)");
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (!validateMagicBytes(buffer, file.type)) {
            return errorResponse("Le contenu du fichier ne correspond pas au format déclaré.");
        }

        const ext = file.name.includes(".") ? file.name.split(".").pop() : file.type.split("/")[1];
        const objectKey = `assignments/${userId}/${randomUUID()}-${sanitizeFilename(file.name || `file.${ext}`)}`;

        const uploaded = await uploadObject(UPLOADS_BUCKET, objectKey, buffer, file.type);

        return successResponse("Fichier uploadé avec succès", {
            url: uploaded.url,
            public_id: objectKey,
            format: ext,
            size: uploaded.size,
        });
    } catch (error) {
        console.error("Upload error:", error);
        return serverErrorResponse("Erreur lors de l'upload", error instanceof Error ? error.message : undefined);
    }
}
