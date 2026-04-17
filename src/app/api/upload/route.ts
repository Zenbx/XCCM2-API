import { NextRequest } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { successResponse, errorResponse, serverErrorResponse } from "@/utils/api-response";

// Cloudinary configuration via env variables
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});

// ─── POST /api/upload ─────────────────────────────────────────────────────────
// Accepts multipart/form-data with a "file" field
// Returns the Cloudinary secure_url to be stored in AssignmentSubmission.content
export async function POST(request: NextRequest) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Utilisateur non authentifié", undefined, 401);

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

        const uploadResult = await new Promise<any>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: `xccm2/assignments/${userId}`,
                    resource_type: "auto",
                    use_filename: false,
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
