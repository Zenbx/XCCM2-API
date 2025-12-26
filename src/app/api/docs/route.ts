/**
 * @fileoverview Route API pour la spécification OpenAPI
 * Retourne le JSON de la documentation Swagger
 */

import { NextResponse } from "next/server";
import { swaggerSpec } from "@/lib/swagger";

/**
 * Handler GET pour récupérer la spécification OpenAPI en JSON
 * @returns Spécification OpenAPI 3.0
 */
export async function GET() {
    return NextResponse.json(swaggerSpec);
}