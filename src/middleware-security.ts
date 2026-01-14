/**
 * @fileoverview Middleware de sécurité pour les communications chiffrées
 * Ajoute les headers de sécurité essentiels (HTTPS, HSTS, etc.)
 */

import { NextRequest, NextResponse } from "next/server";

/**
 * Configuration des headers de sécurité
 */
export const securityHeaders = {
    // Force HTTPS en production
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",

    // Empêche le clickjacking
    "X-Frame-Options": "DENY",

    // Empêche le MIME-sniffing
    "X-Content-Type-Options": "nosniff",

    // Empêche le XSS
    "X-XSS-Protection": "1; mode=block",

    // Contrôle du referrer
    "Referrer-Policy": "strict-origin-when-cross-origin",

    // Content Security Policy
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",

    // Permissions
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
};

/**
 * Middleware pour ajouter les headers de sécurité
 * @param request - Requête Next.js
 * @returns Réponse avec les headers de sécurité
 */
export function middleware(request: NextRequest) {
    const response = NextResponse.next();

    // Ajouter les headers de sécurité
    Object.entries(securityHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
    });

    // Forcer HTTPS en production (sauf sur localhost)
    if (
        process.env.NODE_ENV === "production" &&
        request.headers.get("x-forwarded-proto") !== "https"
    ) {
        return NextResponse.redirect(
            `https://${request.headers.get("host")}${request.nextUrl.pathname}`,
            301
        );
    }

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        "/((?!_next/static|_next/image|favicon.ico).*)",
    ],
};
