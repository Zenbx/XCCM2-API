
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { successResponse, errorResponse, serverErrorResponse } from "@/utils/api-response";
import { verifyToken } from "@/lib/auth";

/**
 * @openapi
 * /api/user/profile:
 *   put:
 *     tags:
 *       - Authentication
 *     summary: Mettre à jour le profil utilisateur
 *     description: Met à jour les informations personnelles et la photo de profil. Supporte multipart/form-data.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               lastname: { type: string }
 *               firstname: { type: string }
 *               occupation: { type: string }
 *               org: { type: string }
 *               profile_picture: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Profil mis à jour
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     user: { $ref: '#/components/schemas/User' }
 */
export async function PUT(request: NextRequest) {
    try {
        // 1. Authenticate user
        const token = request.headers.get("authorization")?.split(" ")[1];
        if (!token) {
            return errorResponse("Non autorisé", undefined, 401);
        }
        const decoded = await verifyToken(token);
        if (!decoded || !decoded.userId) {
            return errorResponse("Token invalide", undefined, 401);
        }
        const userId = decoded.userId as string;

        // 2. Parse FormData
        const formData = await request.formData();

        const lastname = formData.get("lastname") as string;
        const firstname = formData.get("firstname") as string;
        const email = formData.get("email") as string;
        const occupation = formData.get("occupation") as string;
        const org = formData.get("org") as string;
        const profilePictureFile = formData.get("profile_picture") as File | null;

        // 3. Handle specific updates
        const updateData: any = {};
        if (lastname) updateData.lastname = lastname;
        if (firstname) updateData.firstname = firstname;
        if (occupation !== null) updateData.occupation = occupation;
        if (org !== null) updateData.org = org;

        // 4. Handle Image Upload
        if (profilePictureFile && profilePictureFile.size > 0) {
            // Validate
            if (!profilePictureFile.type.startsWith("image/")) {
                return errorResponse("Le fichier doit être une image", undefined, 400);
            }
            if (profilePictureFile.size > 5 * 1024 * 1024) {
                return errorResponse("L'image ne doit pas dépasser 5 Mo", undefined, 400);
            }

            // Save
            const { saveProfilePicture } = await import("@/lib/storage");
            const profilePicturePath = await saveProfilePicture(profilePictureFile);
            updateData.profile_picture = profilePicturePath;
        }

        // 5. Update Database
        const updatedUser = await prisma.user.update({
            where: { user_id: userId },
            data: updateData,
            select: {
                user_id: true,
                email: true,
                firstname: true,
                lastname: true,
                occupation: true,
                org: true,
                profile_picture: true,
                created_at: true,
            }
        });

        return successResponse("Profil mis à jour avec succès", { user: updatedUser });

    } catch (error) {
        console.error("Erreur lors de la mise à jour du profil:", error);
        return serverErrorResponse("Erreur serveur lors de la mise à jour");
    }
}
