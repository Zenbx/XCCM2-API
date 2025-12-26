/**
 * @fileoverview Configuration Next.js pour l'application XCCM
 * Définit les paramètres du serveur, des images, et des en-têtes HTTP
 */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Active le mode strict de React
    reactStrictMode: true,

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

    // En-têtes HTTP personnalisés
    async headers() {
        return [
            {
                source: "/api/:path*",
                headers: [
                    { key: "Access-Control-Allow-Credentials", value: "true" },
                    { key: "Access-Control-Allow-Origin", value: "*" },
                    { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT,OPTIONS" },
                    {
                        key: "Access-Control-Allow-Headers",
                        value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization",
                    },
                ],
            },
        ];
    },
};

export default nextConfig;