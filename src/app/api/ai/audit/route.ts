import { NextRequest } from "next/server";
import { auditPedagogy } from "@/lib/socratic-ai";
import { successResponse, serverErrorResponse, errorResponse } from "@/utils/api-response";
import { verifyToken } from "@/lib/auth";

/**
 * @swagger
 * /api/ai/audit:
 *   post:
 *     tags:
 *       - AI
 *     summary: Audit pédagogique d'une Notion
 *     description: Analyse le contenu d'une notion (clarté, Bloom, engagement) et propose des améliorations.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: Le contenu HTML ou texte de la notion à auditer.
 *     responses:
 *       200:
 *         description: Audit réussi
 *       401:
 *         description: Non authentifié
 *       500:
 *         description: Erreur serveur (AI non disponible)
 */

export async function POST(request: NextRequest) {
    try {
        // Authentification obligatoire
        const authHeader = request.headers.get("Authorization");
        if (!authHeader) {
            return errorResponse("Authentification requise", undefined, 401);
        }

        const token = authHeader.split(" ")[1];
        const payload = await verifyToken(token);
        if (!payload) {
            return errorResponse("Token invalide", undefined, 401);
        }

        const { content } = await request.json();

        if (!content || content.trim() === "") {
            return errorResponse("Le contenu est vide", undefined, 400);
        }

        // Appel du service d'audit
        const auditResult = await auditPedagogy(content);

        return successResponse("Audit pédagagique terminé avec succès", auditResult);

    } catch (error: any) {
        console.error("[api/ai/audit] Error:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de l'audit AI",
            error.message
        );
    }
}
