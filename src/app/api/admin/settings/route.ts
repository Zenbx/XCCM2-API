import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    serverErrorResponse,
} from "@/utils/api-response";

// Modèle de configuration pour les settings
interface PlatformSettings {
    platformName?: string;
    supportUrl?: string;
    metaDescription?: string;
    maintenanceMode?: boolean;
    twoFactorRequired?: boolean;
    detailedLogs?: boolean;
    sessionExpiration?: boolean;
    ipWhitelist?: boolean;
}

/**
 * GET /api/admin/settings
 * Récupère les paramètres de la plateforme
 */
export async function GET(request: NextRequest) {
    try {
        const userRole = request.headers.get("x-user-role");

        if (userRole?.toLowerCase() !== "admin") {
            return errorResponse("Accès refusé", undefined, 403);
        }

        // Pour l'instant, nous retournons des valeurs par défaut
        // Dans une vraie implémentation, ces valeurs seraient stockées dans la DB
        const settings: PlatformSettings = {
            platformName: "XCCM 2 - Enterprise",
            supportUrl: "https://support.xccm2.com",
            metaDescription: "La plateforme de composition de cours la plus avancée du marché.",
            maintenanceMode: false,
            twoFactorRequired: true,
            detailedLogs: true,
            sessionExpiration: false,
            ipWhitelist: false,
        };

        return successResponse("Paramètres récupérés", settings);
    } catch (error) {
        console.error("Erreur /api/admin/settings GET:", error);
        return serverErrorResponse(
            "Erreur serveur",
            error instanceof Error ? error.message : undefined
        );
    }
}

/**
 * PUT /api/admin/settings
 * Met à jour les paramètres de la plateforme
 */
export async function PUT(request: NextRequest) {
    try {
        const userRole = request.headers.get("x-user-role");

        if (userRole?.toLowerCase() !== "admin") {
            return errorResponse("Accès refusé", undefined, 403);
        }

        const body = await request.json();
        const updatedSettings: PlatformSettings = body;

        // Validation basique
        if (updatedSettings.platformName && updatedSettings.platformName.trim().length === 0) {
            return errorResponse("Le nom de la plateforme ne peut pas être vide", undefined, 400);
        }

        // Dans une vraie implémentation, sauvegarder dans la DB
        // Pour l'instant, on renvoie juste les valeurs reçues
        console.log("Settings mise à jour:", updatedSettings);

        return successResponse("Paramètres mis à jour avec succès", updatedSettings);
    } catch (error) {
        console.error("Erreur /api/admin/settings PUT:", error);
        return serverErrorResponse(
            "Erreur serveur",
            error instanceof Error ? error.message : undefined
        );
    }
}
