/**
 * @fileoverview Middleware Next.js pour la protection des routes
 * Vérifie le JWT sur les routes protégées et redirige si nécessaire
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken, extractTokenFromHeader } from "@/lib/auth";

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
 * Vérifie l'authentification pour les routes protégées
 * @param request - Requête Next.js
 * @returns NextResponse (continue ou redirige)
 */
export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Laisse passer les routes publiques
    if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
        return NextResponse.next();
    }

    // Laisse passer les fichiers statiques et Next.js internes
    if (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/static") ||
        pathname.includes(".")
    ) {
        return NextResponse.next();
    }

    // Vérifie le token JWT pour les routes API protégées
    if (pathname.startsWith("/api/")) {
        const authHeader = request.headers.get("Authorization");
        const token = extractTokenFromHeader(authHeader);

        if (!token) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Token manquant. Authentification requise.",
                },
                { status: 401 }
            );
        }

        // Vérification asynchrone du token avec jose
        const payload = await verifyToken(token);

        if (!payload) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Token invalide ou expiré.",
                },
                { status: 401 }
            );
        }

        // Ajoute l'userId aux headers pour les routes suivantes
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set("x-user-id", payload.userId);

        return NextResponse.next({
            request: {
                headers: requestHeaders,
            },
        });
    }

    // Laisse passer les autres routes (pages web)
    return NextResponse.next();
}

/**
 * Configuration du matcher pour le middleware
 * Applique le middleware uniquement sur les routes API et pages
 */
export const config = {
    matcher: [
        /*
         * Match toutes les routes sauf:
         * - _next/static (fichiers statiques)
         * - _next/image (optimisation d'images)
         * - favicon.ico (icône)
         */
        "/((?!_next/static|_next/image|favicon.ico).*)",
    ],
};