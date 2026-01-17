/**
 * @fileoverview Middleware Next.js global
 * - Gère le CORS (preflight OPTIONS + headers)
 * - Laisse passer les routes publiques
 * - NextAuth gère l'authentification automatiquement
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
    "/api/auth",                 // NextAuth routes (signin, signout, callback, etc)
    "/api/auth/login",
    "/api/auth/register",
    "/api/health",
    "/api/docs",
    "/docs",
    "/api/documents",            // Bibliothèque publique (GET liste + GET par ID)
    "/api/invitations/",         // Consultation invitation par token (GET)
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
     * 4️⃣ Laisse passer les routes publiques et NextAuth sans authentification
     */
    if (PUBLIC_ROUTES.some((route: string) => pathname.startsWith(route))) {
        return response;
    }

    /**
     * 5️⃣ Les autres routes API sont protégées par NextAuth automatiquement
     * NextAuth gère la session via le cookie de session
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