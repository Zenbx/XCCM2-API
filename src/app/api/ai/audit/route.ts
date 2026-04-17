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

        const { content } = await request.json();
        if (!content?.trim()) return errorResponse("Le contenu est vide", undefined, 400);

        // ✅ Vérification de la clé API Mistral
        if (!process.env.MISTRAL_API_KEY) {
            console.warn("[Audit AI] MISTRAL_API_KEY missing, returning mock response");
            return successResponse("⚠️ Mode Démo - Socrate AI", {
                clarityScore: 85,
                engagementScore: 75,
                bloomLevel: "Comprendre",
                suggestions: [
                    "🚧 Fonctionnalité en développement : Socrate AI n'est pas encore complètement opérationnel.",
                    "💡 Cette fonctionnalité analyse votre contenu selon la taxonomie de Bloom et propose des améliorations pédagogiques.",
                    "📊 Scores affichés ci-dessus sont des exemples pour démonstration.",
                    "🔧 Pour activer la vraie analyse IA, configurez MISTRAL_API_KEY dans votre .env backend."
                ],
                recommendedBlocks: ["Quiz", "Exemple", "Définition"],
                isDemoMode: true
            });
        }

        const systemPrompt = `Tu es SocrateAI, un expert mondial en ingénierie pédagogique et design d'apprentissage.
Ton objectif est d'aider l'auteur à transformer un contenu brut en une expérience d'apprentissage exceptionnelle et engageante.

ANALYSE REQUISE :
1. BLOOM : Identifie le niveau cognitif actuel (Mémoriser, Comprendre, Appliquer, Analyser, Évaluer, Créer).
2. CLARTÉ : Évalue la simplicité et la structure du texte (Score 0-100).
3. ENGAGEMENT : Évalue la capacité à captiver l'apprenant (Score 0-100).
4. QUESTIONS SOCRATIQUES : Propose 3 questions qui poussent l'élève à réfléchir plus loin au lieu de simplement lire.
5. BLOCS SUGGÉRÉS : Recommande 3 types de composants (Quiz, Code, Math, Note, Exemple) pour dynamiser la notion.

TON : Professionnel, encourageant, mais exigeant sur la qualité didactique.

FORMAT JSON STRICT EXIGÉ (sans markdown, sans backticks, juste le JSON brut) :
{
  "clarityScore": number,
  "engagementScore": number,
  "bloomLevel": "Mémoriser" | "Comprendre" | "Appliquer" | "Analyser" | "Évaluer" | "Créer",
  "suggestions": ["Question 1", "Question 2", "Question 3"],
  "recommendedBlocks": ["Quiz" | "Code" | "Math" | "Note" | "Exemple"]
}`;

        console.log("[Audit AI] Calling Gemini API...");

        const { text: rawContent } = await generateText({
            model: mistral('mistral-medium-latest'),
            system: systemPrompt,
            prompt: `Voici le contenu pédagogique à auditer :\n---\n${content.substring(0, 8000)}\n---\nGénère l'audit JSON maintenant.`,
            temperature: 0.1,
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
