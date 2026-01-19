import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { successResponse, errorResponse, serverErrorResponse } from "@/utils/api-response";
import { verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get("Authorization");
        if (!authHeader) return errorResponse("Authentification requise", undefined, 401);

        const token = authHeader.split(" ")[1];
        const payload = await verifyToken(token);
        if (!payload) return errorResponse("Token invalide", undefined, 401);

        // Check Admin Role (or legacy no-role)
        const requestor = await prisma.user.findUnique({ where: { user_id: payload.userId } });
        const isAdmin = requestor?.role === 'admin' || !requestor?.role; // Default to admin if no role (legacy)

        if (!isAdmin) {
            return errorResponse("Accès refusé. Réservé aux administrateurs.", undefined, 403);
        }

        const users = await prisma.user.findMany({
            select: {
                user_id: true,
                firstname: true,
                lastname: true,
                email: true,
                role: true,
                created_at: true,
                _count: {
                    select: {
                        projects: true,
                        marketplaceItems: true
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        });

        // Safe mapping to handle potential schema mismatches or undefined counts
        const safeUsers = users.map((u: any) => ({
            ...u,
            projectsCount: u._count?.projects || 0,
            marketplaceCount: u._count?.marketplaceItems || 0,
            _count: undefined // Clean up
        }));

        return successResponse("Liste des utilisateurs récupérée", safeUsers);

    } catch (error: any) {
        console.error("Error listing users:", error);
        return serverErrorResponse("Erreur lors de la récupération des utilisateurs", error.message);
    }
}
