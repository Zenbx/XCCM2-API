import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    serverErrorResponse,
    forbiddenResponse,
    notFoundResponse,
} from "@/utils/api-response";

// ─── GET /api/classrooms/[classId]/announcements ─────────────────────────────
// Returns all announcements for the class (teachers + enrolled students)
export async function GET(
    request: NextRequest,
    { params }: { params: { classId: string } }
) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Utilisateur non authentifié", undefined, 401);

        const { classId } = params;

        // Check user is member of this class (teacher or student)
        const classroom = await prisma.classroom.findUnique({
            where: { id: classId },
            include: { enrollments: { where: { student_id: userId } } },
        });

        if (!classroom) return notFoundResponse("Classe introuvable");

        const isMember =
            classroom.teacher_id === userId || classroom.enrollments.length > 0;

        if (!isMember)
            return forbiddenResponse("Vous n'avez pas accès à cette classe");

        const announcements = await prisma.announcement.findMany({
            where: { classroom_id: classId },
            orderBy: { created_at: "desc" },
            include: {
                author: {
                    select: { user_id: true, firstname: true, lastname: true, profile_picture: true },
                },
                comments: {
                    orderBy: { created_at: "asc" },
                    include: {
                        author: {
                            select: { user_id: true, firstname: true, lastname: true, profile_picture: true },
                        },
                    },
                },
            },
        });

        return successResponse("Annonces récupérées", { announcements });
    } catch (error) {
        return serverErrorResponse("Erreur lors de la récupération des annonces", error instanceof Error ? error.message : undefined);
    }
}

// ─── POST /api/classrooms/[classId]/announcements ────────────────────────────
// Creates an announcement (teacher only) and notifies all enrolled students
export async function POST(
    request: NextRequest,
    { params }: { params: { classId: string } }
) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Utilisateur non authentifié", undefined, 401);

        const { classId } = params;

        // Only the teacher can post announcements
        const classroom = await prisma.classroom.findUnique({
            where: { id: classId },
            include: {
                enrollments: { select: { student_id: true } },
            },
        });

        if (!classroom) return notFoundResponse("Classe introuvable");
        if (classroom.teacher_id !== userId)
            return forbiddenResponse("Seul le professeur peut publier des annonces");

        const body = await request.json();
        const { content } = body;

        if (!content || content.trim().length === 0) {
            return errorResponse("Le contenu de l'annonce est requis");
        }

        const announcement = await prisma.announcement.create({
            data: {
                content: content.trim(),
                classroom_id: classId,
                author_id: userId,
            },
            include: {
                author: {
                    select: { user_id: true, firstname: true, lastname: true, profile_picture: true },
                },
                comments: [],
            },
        });

        // Dispatch notifications to all enrolled students
        const notificationData = classroom.enrollments.map((enrollment) => ({
            user_id: enrollment.student_id,
            type: "NEW_ANNOUNCEMENT",
            message: `Nouvelle annonce dans la classe "${classroom.name}"`,
            link: `/classrooms/${classId}`,
        }));

        if (notificationData.length > 0) {
            await prisma.notification.createMany({ data: notificationData });
        }

        return successResponse("Annonce publiée avec succès", { announcement }, 201);
    } catch (error) {
        return serverErrorResponse("Erreur lors de la publication", error instanceof Error ? error.message : undefined);
    }
}
