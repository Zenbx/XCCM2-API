/**
 * @fileoverview Configuration Next.js pour l'application XCCM
 * Définit les paramètres du serveur, des images, et des en-têtes HTTP
 */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Active le mode strict de React
    reactStrictMode: true,

    serverExternalPackages: ['pdfkit'], // Indique à Next.js de ne pas "bundler" pdfkit

    // Configuration des images
    images: {
        domains: ["localhost"],
        remotePatterns: [
            {
                protocol: "https",
                hostname: "**",
            },
        ],
    },

    // En-têtes HTTP personnalisés (laissés vides car gérés par le middleware)
    async headers() {
        return [];
    },
};

export default nextConfig;