/**
 * @fileoverview Middleware Next.js global
 * - Gère le CORS (preflight OPTIONS + headers)
 * - Protège les routes API avec JWT
 * - Laisse passer les routes publiques
 * - Injecte l'userId dans les headers (x-user-id)
 * - Applique les headers de sécurité HTTP sur toutes les réponses
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken, extractTokenFromHeader } from "@/lib/auth";
import { isTokenBlacklisted } from "@/lib/tokenBlacklist";

/**
 * Headers de sécurité HTTP appliqués sur toutes les réponses
 */
const SECURITY_HEADERS: Record<string, string> = {
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=(), usb=()",
    "Content-Security-Policy": [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self'",
        "img-src 'self' data: https://res.cloudinary.com https://*.cloudinary.com",
        "font-src 'self' data:",
        "connect-src 'self' https://*.upstash.io wss://*.pusher.com https://*.ably.io wss://*.ably.io",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ].join("; "),
};

// CSP relaxé pour la page Swagger UI (/docs) — swagger-ui-react utilise des styles et scripts inline
const SWAGGER_CSP = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://res.cloudinary.com https://*.cloudinary.com",
    "font-src 'self' data:",
    "connect-src 'self' https://*.upstash.io wss://*.pusher.com https://*.ably.io wss://*.ably.io",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
].join("; ");

function applySecurityHeaders(response: NextResponse, isSwaggerPage = false): void {
    const headers = { ...SECURITY_HEADERS };
    if (isSwaggerPage) {
        headers["Content-Security-Policy"] = SWAGGER_CSP;
    }

    if (process.env.NODE_ENV === "production") {
        Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
        });
    } else {
        Object.entries(headers).forEach(([key, value]) => {
            if (key !== "Strict-Transport-Security") {
                response.headers.set(key, value);
            }
        });
    }
}

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
        "https://xccm-2-api.vercel.app",
        "https://xccm-2.vercel.app",
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
    "/api/auth/signin",            // NextAuth sign in routes (Google, Microsoft, etc.)
    "/api/auth/error",             // NextAuth error page
    "/api/auth/session",           // NextAuth session endpoint
    "/api/auth/bridge",            // Bridge to convert Session to JWT/Token
    "/api/auth/session-token",     // Bridge endpoint to convert NextAuth session to JWT
    "/api/auth/providers",         // NextAuth providers list
    "/api/auth/csrf",              // NextAuth CSRF token
    "/api/auth/signout",           // NextAuth sign out
    "/api/auth/refresh",           // Refresh token (valide le token en interne)

    // Other public routes
    "/auth",
    "/api/health",
    "/api/docs",
    "/docs",
    "/api/documents",           // Bibliothèque publique (GET liste + GET par ID)
    "/api/invitations/",        // Consultation invitation par token (GET)
    // /api/users/ retiré des routes publiques — protégé par JWT + vérification admin dans la route
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
    const isSwaggerPage = pathname === "/docs";

    /**
     * 1️⃣ Gestion des requêtes OPTIONS (CORS preflight)
     */
    if (request.method === "OPTIONS") {
        const preflightResponse = new NextResponse(null, {
            status: 200,
            headers: corsHeaders,
        });
        applySecurityHeaders(preflightResponse, isSwaggerPage);
        return preflightResponse;
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
     * 3️⃣ Prépare la réponse avec les headers CORS + sécurité
     * Ces headers doivent être présents sur TOUTES les réponses API
     */
    const response = NextResponse.next();

    Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
    });
    applySecurityHeaders(response, isSwaggerPage);

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
            const r = NextResponse.json(
                { success: false, message: "Token manquant. Authentification requise." },
                { status: 401, headers: corsHeaders }
            );
            applySecurityHeaders(r);
            return r;
        }

        // Vérifie le token JWT
        const payload = await verifyToken(token);

        if (!payload) {
            const r = NextResponse.json(
                { success: false, message: "Token invalide ou expiré." },
                { status: 401, headers: corsHeaders }
            );
            applySecurityHeaders(r);
            return r;
        }

        // Vérifie que le token n'est pas révoqué (blacklist logout)
        const revoked = await isTokenBlacklisted(token);
        if (revoked) {
            const r = NextResponse.json(
                { success: false, message: "Session expirée. Veuillez vous reconnecter." },
                { status: 401, headers: corsHeaders }
            );
            applySecurityHeaders(r);
            return r;
        }

        /**
         * 6️⃣ Ajoute l'userId dans les headers
         * Accessible dans les routes via request.headers.get('x-user-id')
         */
        const requestHeaders = new Headers(request.headers);

        const userId = (payload as any).userId;
        const userRole = (payload as any).role || 'user';

        requestHeaders.set("x-user-id", String(userId));
        requestHeaders.set("x-user-role", String(userRole));

        const responseWithHeaders = NextResponse.next({
            request: { headers: requestHeaders },
        });

        Object.entries(corsHeaders).forEach(([key, value]) => {
            responseWithHeaders.headers.set(key, value);
        });
        applySecurityHeaders(responseWithHeaders, isSwaggerPage);

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