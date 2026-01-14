/**
 * @fileoverview Middleware Next.js global
 *
 * - Gère le CORS (preflight OPTIONS + headers)
 * - Protège les routes API avec JWT
 * - Laisse passer les routes publiques
 * - Injecte l'userId dans les headers (x-user-id)
 *
 * ⚠️ IMPORTANT :
 * Le CORS DOIT être géré AVANT toute vérification d'authentification,
 * sinon le navigateur bloque la requête avant qu'elle n'arrive à la route.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken, extractTokenFromHeader } from "@/lib/auth";

/**
 * Origine autorisée (frontend)
 * À adapter en production
 */
const ALLOWED_ORIGIN = "http://localhost:3000";

/**
 * Headers CORS communs
 */
const CORS_HEADERS = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
};

/**
 * Routes publiques accessibles sans authentification
 */
const PUBLIC_ROUTES = [
    "/api/auth/login",
    "/api/auth/register",
    "/api/health",
    "/api/docs",
    "/docs",
];

/**
 * Middleware Next.js exécuté avant chaque requête
 * @param request - Requête Next.js
 * @returns NextResponse
 */
export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    /**
     * 1️⃣ Gestion des requêtes OPTIONS (CORS preflight)
     * Le navigateur envoie automatiquement cette requête avant
     * toute requête "non simple" (Authorization, JSON, etc.)
     */
    if (request.method === "OPTIONS") {
        return new NextResponse(null, {
            status: 200,
            headers: CORS_HEADERS,
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

    Object.entries(CORS_HEADERS).forEach(([key, value]) => {
        response.headers.set(key, value);
    });

    /**
     * 4️⃣ Laisse passer les routes publiques sans authentification
     */
    if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
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
                { status: 401, headers: CORS_HEADERS }
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
                { status: 401, headers: CORS_HEADERS }
            );
        }

        /**
         * 6️⃣ Ajoute l'userId dans les headers
         * Accessible dans les routes via request.headers.get('x-user-id')
         */
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set("x-user-id", payload.userId);

        return NextResponse.next({
            request: {
                headers: requestHeaders,
            },
        });
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
