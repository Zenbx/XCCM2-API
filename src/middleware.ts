/**
 * @fileoverview Middleware Next.js global
 * - Gère le CORS (preflight OPTIONS + headers)
 * - Protège les routes API avec JWT
 * - Laisse passer les routes publiques
 * - Injecte l'userId dans les headers (x-user-id)
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken, extractTokenFromHeader } from "@/lib/auth";

/**
 * Récupère les headers CORS dynamiquement pour autoriser l'origine de la requête
 */
function getCorsHeaders(request: NextRequest) {
    const origin = request.headers.get("origin") || "*";

    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id, X-Requested-With, Accept",
        "Access-Control-Allow-Credentials": "true",
    };
}

/**
 * Routes publiques accessibles sans authentification
 */
const PUBLIC_ROUTES: string[] = [
    "/api/auth/login",
    "/api/auth/register",
    "/api/health",
    "/api/docs",
    "/docs",
    "/api/documents",           // Bibliothèque publique (GET liste + GET par ID)
    "/api/invitations/",        // Consultation invitation par token (GET)
];

/**
 * Middleware Next.js exécuté avant chaque requête
 * @param request - Requête Next.js
 * @returns NextResponse
 */
export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const corsHeaders = getCorsHeaders(request);

    /**
     * 1️⃣ Gestion des requêtes OPTIONS (CORS preflight)
     */
    if (request.method === "OPTIONS") {
        return new NextResponse(null, {
            status: 200,
            headers: corsHeaders,
        });
    }

    /**
     * 2️⃣ Laisse passer les fichiers statiques et routes internes Next.js
     */
    if (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/static") ||
        (pathname.includes(".") && !pathname.startsWith("/api/"))
    ) {
        return NextResponse.next();
    }

    /**
     * 3️⃣ Prépare la réponse avec les headers CORS
     * Ces headers doivent être présents sur TOUTES les réponses API
     */
    const response = NextResponse.next();

    Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
    });

    /**
     * 4️⃣ Laisse passer les routes publiques sans authentification
     */
    if (PUBLIC_ROUTES.some((route: string) => pathname.startsWith(route))) {
        return response;
    }

    /**
     * 5️⃣ Protection des routes API avec JWT
     */
    if (pathname.startsWith("/api/")) {
        const authHeader = request.headers.get("Authorization");
        const token = extractTokenFromHeader(authHeader);

        if (!token) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Token manquant. Authentification requise.",
                },
                { status: 401, headers: corsHeaders }
            );
        }

        // Vérifie le token JWT
        const payload = await verifyToken(token);

        if (!payload) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Token invalide ou expiré.",
                },
                { status: 401, headers: corsHeaders }
            );
        }

        /**
         * 6️⃣ Ajoute l'userId dans les headers
         * Accessible dans les routes via request.headers.get('x-user-id')
         */
        const requestHeaders = new Headers(request.headers);

        // Type assertion pour s'assurer que payload a une propriété userId
        const userId = (payload as any).userId;
        requestHeaders.set("x-user-id", String(userId));

        const responseWithHeaders = NextResponse.next({
            request: {
                headers: requestHeaders,
            },
        });

        // Appliquer CORS à cette nouvelle réponse
        Object.entries(corsHeaders).forEach(([key, value]) => {
            responseWithHeaders.headers.set(key, value);
        });

        return responseWithHeaders;
    }

    /**
     * 7️⃣ Laisse passer les autres routes (pages web)
     */
    return response;
}

/**
 * Configuration du matcher
 * Applique le middleware à toutes les routes sauf les assets Next.js
 */
export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico).*)",
    ],
};