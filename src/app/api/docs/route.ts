/**
 * @fileoverview Route API pour la spécification OpenAPI
 * Retourne le JSON de la documentation Swagger
 */

import { NextResponse } from "next/server";
import { generateSwaggerSpec } from "@/lib/swagger";

/**
 * Handler GET pour récupérer la spécification OpenAPI en JSON
 * @returns Spécification OpenAPI 3.0
 */
export async function GET() {
    try {
        // Génère la spécification Swagger au runtime
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