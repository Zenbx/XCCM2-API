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
 * Liste des origines autorisées pour CORS
 * Configure via ALLOWED_ORIGINS dans .env (séparées par des virgules)
 */
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map(origin => origin.trim())
    : [
        "http://localhost:3001",      // Frontend dev
        "http://localhost:3000",      // Backend dev
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3000",
    ];

/**
 * Récupère les headers CORS en vérifiant que l'origine est autorisée
 * SÉCURITÉ: N'accepte QUE les origines whitelistées
 */
function getCorsHeaders(request: NextRequest) {
    const requestOrigin = request.headers.get("origin");

    // Vérification de l'origine
    const isAllowedOrigin = requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin);
    const origin = isAllowedOrigin ? requestOrigin : ALLOWED_ORIGINS[0];

    if (requestOrigin && !isAllowedOrigin) {
        console.warn(`⚠️ Origine CORS non autorisée: ${requestOrigin}`);
    }

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
    // Auth routes (excluding /api/auth/me which requires protection)
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/oauth",             // Covers all oauth sub-routes
    "/api/auth/callback",          // Covers all callback sub-routes
    "/api/auth/providers",

    // Other public routes
    "/auth",
    "/api/health",
    "/api/docs",
    "/docs",
    "/api/documents",           // Bibliothèque publique (GET liste + GET par ID)
    "/api/invitations/",        // Consultation invitation par token (GET)
    "/api/users/",              // Profils publics
    "/api/creators/top",        // Top créateurs
    "/api/community/feed",      // Flux communautaire
    "/api/contact",
    "/api/newsletter/subscribe",

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
     * Sauf les actions spécifiques sur les invitations qui nécessitent un userId (accept, decline, revoke)
     */
    const isPublicRoute = PUBLIC_ROUTES.some((route: string) => pathname.startsWith(route));
    const isInvitationAction = pathname.startsWith("/api/invitations/") &&
        (pathname.includes("/accept") ||
            pathname.includes("/decline") ||
            pathname.includes("/revoke"));

    if (isPublicRoute && !isInvitationAction) {
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