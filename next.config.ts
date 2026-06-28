/**
 * @fileoverview Configuration Next.js pour l'application XCCM
 * Définit les paramètres du serveur, des images, et des en-têtes HTTP
 */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    reactStrictMode: true,
    compress: true,

    serverExternalPackages: [
        'pdfkit',
        '@hocuspocus/transformer',
        '@hocuspocus/server',
        'yjs',
        'y-prosemirror',
        'y-protocols',
    ],

    images: {
        domains: ["localhost"],
        minimumCacheTTL: 3600,
        remotePatterns: [
            {
                protocol: "https",
                hostname: "**",
            },
        ],
    },

    experimental: {
        optimizePackageImports: [
            'recharts',
            'lucide-react',
            '@tiptap/react',
            '@tiptap/starter-kit',
        ],
    },

    typescript: {
        ignoreBuildErrors: true,
    },

    eslint: {
        ignoreDuringBuilds: true,
    },

    async headers() {
        return [];
    },
};

export default nextConfig;