/**
 * @openapi
 * /api/ai/audit:
 *   post:
 *     tags:
 *       - AI
 *     summary: Audit pédagogique (Mistral / SocrateAI)
 *     description: Analyse un contenu pédagogique selon la taxonomie de Bloom et retourne scores de clarté, d'engagement et suggestions socratiques.
 *     security:
 *       - bearerAuth: []
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
 *                 description: Contenu pédagogique à auditer
 *     responses:
 *       200:
 *         description: Résultat de l'audit pédagogique
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/AuditResult'
 *       400:
 *         description: Contenu vide
 *       401:
 *         description: Non authentifié
 *       500:
 *         description: Erreur IA
 */
import { NextRequest } from "next/server";
import { generateText } from "ai";
import { mistral } from "@ai-sdk/mistral";
import { successResponse, serverErrorResponse, errorResponse } from "@/utils/api-response";
import { verifyToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get("Authorization");
        if (!authHeader) return errorResponse("Authentification requise", undefined, 401);

        const token = authHeader.split(" ")[1];
        const payload = await verifyToken(token);
        if (!payload) return errorResponse("Token invalide", undefined, 401);

        const body = await request.json();
        const { content, context } = body;
        if (!content?.trim()) return errorResponse("Le contenu est vide", undefined, 400);

        const contextBlock = context ? `
CONTEXTE DU COURS :
- Projet : ${context.projectName || '—'}
- Partie : ${context.partTitle || '—'}
- Chapitre : ${context.chapterTitle || '—'}
- Paragraphe : ${context.paraName || '—'}
- Notion actuelle : ${context.notionName || '—'}
` : '';

        // ✅ Vérification de la clé API Mistral
        if (!process.env.MISTRAL_API_KEY) {
            console.warn("[Audit AI] MISTRAL_API_KEY missing, returning mock response");
            return successResponse("⚠️ Mode Démo - Socrate AI", {
                clarityScore: 85,
                engagementScore: 75,
                bloomLevel: "Comprendre",
                suggestions: [
                    "Comment pourriez-vous illustrer ce concept avec un exemple concret ?",
                    "Quelles questions un apprenant débutant se poserait-il en lisant ce contenu ?",
                    "Comment relieriez-vous ce sujet à une situation réelle ?"
                ],
                recommendedBlocks: ["Quiz", "Exemple", "Définition"],
                improvedContent: content,
                suggestedGranules: [
                    { type: "notion", title: "Exercices pratiques", description: "Mise en application des concepts vus", rationale: "Renforcer la compréhension par la pratique" },
                    { type: "paragraph", title: "Cas d'usage concrets", description: "Exemples réels liés au thème", rationale: "Ancrer l'apprentissage dans la réalité" },
                    { type: "notion", title: "Synthèse et points clés", description: "Résumé des notions essentielles", rationale: "Consolider les acquis avant de passer à la suite" }
                ],
                isDemoMode: true
            });
        }

        const systemPrompt = `Tu es SocrateAI, un expert mondial en ingénierie pédagogique et design d'apprentissage.
Ton objectif est d'aider l'auteur à transformer un contenu brut en une expérience d'apprentissage exceptionnelle.
${contextBlock}
ANALYSE REQUISE :
1. BLOOM : Identifie le niveau cognitif actuel (Mémoriser, Comprendre, Appliquer, Analyser, Évaluer, Créer).
2. CLARTÉ : Score 0-100 sur la simplicité et la structure du texte.
3. ENGAGEMENT : Score 0-100 sur la capacité à captiver l'apprenant.
4. QUESTIONS SOCRATIQUES : 3 questions qui poussent l'élève à réfléchir plutôt que lire passivement.
5. BLOCS SUGGÉRÉS : 2-3 types de composants parmi (Quiz, Code, Math, Note, Exemple, Définition).
6. VERSION AMÉLIORÉE : Réécris le contenu HTML en le rendant plus clair, structuré et engageant. Utilise uniquement des balises HTML simples (p, strong, em, ul, li, h3). Ne dépasse pas 800 mots.
7. GRANULES SUGGÉRÉS : Propose 3 à 5 granules pédagogiques pertinents pour enrichir la suite de ce cours dans le même thème. Chacun doit être logique et complémentaire au contenu analysé.

TON : Professionnel, encourageant, exigeant sur la qualité didactique.

FORMAT JSON STRICT (sans markdown, sans backticks) :
{
  "clarityScore": number,
  "engagementScore": number,
  "bloomLevel": "Mémoriser" | "Comprendre" | "Appliquer" | "Analyser" | "Évaluer" | "Créer",
  "suggestions": ["Question 1", "Question 2", "Question 3"],
  "recommendedBlocks": ["Quiz", "Exemple"],
  "improvedContent": "<p>Contenu HTML amélioré ici...</p>",
  "suggestedGranules": [
    { "type": "notion" | "paragraph" | "chapter" | "part", "title": "Titre du granule", "description": "Ce que ce granule couvrira", "rationale": "Pourquoi ce granule est pertinent ici" }
  ]
}`;

        console.log("[Audit AI] Calling Mistral API...");

        const { text: rawContent } = await generateText({
            model: mistral('mistral-medium-latest'),
            system: systemPrompt,
            prompt: `Voici le contenu pédagogique à auditer :\n---\n${content.substring(0, 8000)}\n---\nGénère l'audit JSON complet maintenant.`,
            temperature: 0.2,
        });

        console.log("[Audit AI] Response received");

        // Robust JSON extraction
        let auditResult;
        try {
            // Robust JSON extraction (handle markdown backticks if model adds them)
            const cleanJson = rawContent
              .replace(/```json/g, '')
              .replace(/```/g, '')
              .trim();
            
            const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
            const finalJson = jsonMatch ? jsonMatch[0] : cleanJson;
            auditResult = JSON.parse(finalJson);
        } catch (e) {
            console.error("[Audit AI] JSON Parse Fail:", rawContent);
            auditResult = {
                clarityScore: 75,
                engagementScore: 70,
                bloomLevel: "Comprendre",
                suggestions: ["Votre contenu est intéressant mais l'analyse automatique a rencontré une erreur de formatage. Posez-vous la question : comment rendre ce texte plus interactif ?"],
                recommendedBlocks: ["Exemple", "Quiz"]
            };
        }

        return successResponse("Audit pédagogique terminé", auditResult);

    } catch (error: any) {
        console.error("[api/ai/audit] Error:", error);
        return serverErrorResponse("Erreur lors de l'audit AI", error.message);
    }
}
