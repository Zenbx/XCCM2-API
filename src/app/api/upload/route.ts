/**
 * @openapi
 * /api/upload:
 *   post:
 *     tags:
 *       - Upload
 *     summary: Uploader un fichier vers Cloudinary
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
 *                 description: Fichier à uploader (PDF, JPEG, PNG, WEBP — max 10 Mo)
 *     responses:
 *       200:
 *         description: Fichier uploadé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/UploadResult'
 *       400:
 *         description: Format non supporté, taille dépassée ou magic bytes invalides
 *       401:
 *         description: Non authentifié
 *       429:
 *         description: Limite d'upload atteinte (20/h)
 *       500:
 *         description: Erreur Cloudinary
 */
import { NextRequest } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { successResponse, errorResponse, serverErrorResponse } from "@/utils/api-response";
import { rateLimit } from "@/lib/rateLimit";

// Cloudinary configuration via env variables
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});

// Signatures des formats autorisés (magic bytes)
const MAGIC_BYTES: Record<string, number[][]> = {
    "image/jpeg": [[0xFF, 0xD8, 0xFF]],
    "image/png":  [[0x89, 0x50, 0x4E, 0x47]],
    "image/webp": [[0x52, 0x49, 0x46, 0x46]], // RIFF header
    "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
};

function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
    const signatures = MAGIC_BYTES[mimeType];
    if (!signatures) return false;
    return signatures.some((sig) =>
        sig.every((byte, i) => buffer[i] === byte)
    );
}

// ─── POST /api/upload ─────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Utilisateur non authentifié", undefined, 401);

        // 20 uploads max par user par heure
        const rl = await rateLimit(`upload:${userId}`, 20, 60 * 60);
        if (!rl.allowed) {
            return errorResponse("Limite d'upload atteinte. Réessayez dans 1 heure.", undefined, 429);
        }

        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) return errorResponse("Aucun fichier fourni");

        // Validate type & size (max 10MB)
        const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
        const maxSize = 10 * 1024 * 1024; // 10MB

        if (!allowedTypes.includes(file.type)) {
            return errorResponse("Format non supporté. Formats acceptés : PDF, JPEG, PNG, WEBP");
        }

        if (file.size > maxSize) {
            return errorResponse("Le fichier dépasse la taille maximale autorisée (10 Mo)");
        }

        // Convert File to Buffer for Cloudinary upload_stream
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Validation des magic bytes — empêche le spoofing du Content-Type
        if (!validateMagicBytes(buffer, file.type)) {
            return errorResponse("Le contenu du fichier ne correspond pas au format déclaré.");
        }

        const uploadResult = await new Promise<any>((resolve, reject) => {
            const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: `xccm2/assignments/${userId}`,
                    resource_type: isPdf ? "raw" : "auto",
                    // For PDFs: preserve the original filename (including .pdf extension) in
                    // the Cloudinary public_id so the URL ends in .pdf. Without this,
                    // Cloudinary generates a random ID with no extension and browsers
                    // can't identify the file as PDF (wrong Content-Type served).
                    use_filename: isPdf,
                    unique_filename: true,
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            uploadStream.end(buffer);
        });

        return successResponse("Fichier uploadé avec succès", {
            url: uploadResult.secure_url,
            public_id: uploadResult.public_id,
            format: uploadResult.format,
            size: uploadResult.bytes,
        });
    } catch (error) {
        console.error("Upload error:", error);
        return serverErrorResponse("Erreur lors de l'upload", error instanceof Error ? error.message : undefined);
    }
}
