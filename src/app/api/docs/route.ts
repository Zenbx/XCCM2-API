/**
 * @fileoverview Route API pour la spécification OpenAPI
 * Retourne le JSON de la documentation Swagger
 */

import { NextResponse } from "next/server";
import { generateSwaggerSpec } from "@/lib/swagger";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Handler GET pour récupérer la spécification OpenAPI en JSON
 * @returns Spécification OpenAPI 3.0
 */
export async function GET() {
    try {
        // 1. Essayer de charger le fichier pré-généré (Build time)
        const staticPath = join(process.cwd(), "public", "swagger.json");
        if (existsSync(staticPath)) {
            console.log("📄 Serving static Swagger spec from public/swagger.json");
            const staticSpec = JSON.parse(readFileSync(staticPath, "utf-8"));
            return NextResponse.json(staticSpec, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET",
                },
            });
        }

        // 2. Fallback: Génération au runtime (Dev mode)
        console.log("🏗️ Generating Swagger spec at runtime");
        const swaggerSpec = generateSwaggerSpec();

        return NextResponse.json(swaggerSpec, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET",
            },
        });
    } catch (error) {
        console.error("Erreur lors de la génération Swagger:", error);

        // Correction TypeScript: convertir l'erreur en string
        const errorMessage = error instanceof Error ? error.message : String(error);

        return NextResponse.json(
            {
                success: false,
                message: "Erreur lors de la génération de la documentation",
                error: errorMessage
            },
            { status: 500 }
        );
    }
}

/**
 * Handler OPTIONS pour le CORS
 */
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
    });
}