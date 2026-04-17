import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    serverErrorResponse,
} from "@/utils/api-response";

// ─── GET /api/notifications ──────────────────────────────────────────────────
// Returns all notifications for the logged-in user (max 50, unread first)
export async function GET(request: NextRequest) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Utilisateur non authentifié", undefined, 401);

        const notifications = await prisma.notification.findMany({
            where: { user_id: userId },
            orderBy: [{ is_read: "asc" }, { created_at: "desc" }],
            take: 50,
        });

        const unreadCount = notifications.filter((n) => !n.is_read).length;

        return successResponse("Notifications récupérées", { notifications, unreadCount });
    } catch (error) {
        return serverErrorResponse("Erreur lors de la récupération des notifications", error instanceof Error ? error.message : undefined);
    }
}

// ─── PATCH /api/notifications ─────────────────────────────────────────────────
// Mark one or all notifications as read
// Body: { all: true } OR { notificationId: "xxx" }
export async function PATCH(request: NextRequest) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Utilisateur non authentifié", undefined, 401);

        const body = await request.json();
        const { all, notificationId } = body;

        if (all) {
            await prisma.notification.updateMany({
                where: { user_id: userId, is_read: false },
                data: { is_read: true },
            });
            return successResponse("Toutes les notifications marquées comme lues");
        }

        if (notificationId) {
            await prisma.notification.updateMany({
                where: { id: notificationId, user_id: userId },
                data: { is_read: true },
            });
            return successResponse("Notification marquée comme lue");
        }

        return errorResponse("Paramètre manquant : all ou notificationId requis");
    } catch (error) {
        return serverErrorResponse("Erreur", error instanceof Error ? error.message : undefined);
    }
}
