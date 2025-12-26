/**
 * @fileoverview Route API de santé (healthcheck)
 * Permet de vérifier que l'API est fonctionnelle
 *
 * @swagger
 * /api/health:
 *   get:
 *     tags:
 *       - Health
 *     summary: Vérification de l'état de l'API
 *     description: Endpoint simple pour vérifier que l'API fonctionne correctement
 *     responses:
 *       200:
 *         description: API fonctionnelle
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: API fonctionne correctement
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: ok
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                       example: 2024-01-15T10:30:00.000Z
 *                     environment:
 *                       type: string
 *                       example: development
 */

import { successResponse } from "@/utils/api-response";

/**
 * Handler GET pour le healthcheck
 * @returns Réponse JSON indiquant que l'API fonctionne
 */
export async function GET() {
    return successResponse("API fonctionne correctement", {
        status: "ok",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
    });
}