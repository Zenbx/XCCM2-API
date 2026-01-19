import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import prisma from "@/lib/prisma";
import { generateToken, toPublicUser } from "@/lib/auth";
import { successResponse, unauthorizedResponse, serverErrorResponse } from "@/utils/api-response";

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !session.user || !session.user.email) {
            return unauthorizedResponse("Aucune session SSO trouvée");
        }

        // Récupérer l'utilisateur complet depuis la BD
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return unauthorizedResponse("Utilisateur non trouvé en base");
        }

        const publicUser = toPublicUser(user);
        const token = await generateToken(publicUser);

        return successResponse("Token généré avec succès", {
            user: publicUser,
            token: token
        });
    } catch (error) {
        console.error("Erreur session-token:", error);
        return serverErrorResponse("Erreur lors de la génération du token SSO");
    }
}
