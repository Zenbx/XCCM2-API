import { NextRequest } from "next/server";
import { HfInference } from "@huggingface/inference";
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

        // ✅ Robust API Key Detection
        const apiKey = process.env.HUGGINGFACE_API_KEY || process.env.HUGGING_FACE_API_KEY || process.env.HF_API_TOKEN;

        if (!apiKey) {
            console.warn("HUGGINGFACE_API_KEY missing, returning mock response");
            return successResponse("⚠️ Mode Démo - Socrate AI", {
                clarityScore: 85,
                engagementScore: 75,
                bloomLevel: "Comprendre",
                suggestions: [
                    "🚧 Fonctionnalité en développement : Socrate AI n'est pas encore complètement opérationnel.",
                    "💡 Cette fonctionnalité analyse votre contenu selon la taxonomie de Bloom et propose des améliorations pédagogiques.",
                    "📊 Scores affichés ci-dessus sont des exemples pour démonstration.",
                    "🔧 Pour activer la vraie analyse IA, configurez HUGGING_FACE_API_KEY dans votre .env backend."
                ],
                recommendedBlocks: ["Quiz", "Exemple", "Définition"],
                isDemoMode: true
            });
        }

        const hf = new HfInference(apiKey);

        const systemPrompt = `Tu es SocrateAI, un expert mondial en ingénierie pédagogique et design d'apprentissage.
Ton objectif est d'aider l'auteur à transformer un contenu brut en une expérience d'apprentissage exceptionnelle et engageante.

ANALYSE REQUISE :
1. BLOOM : Identifie le niveau cognitif actuel (Mémoriser, Comprendre, Appliquer, Analyser, Évaluer, Créer).
2. CLARTÉ : Évalue la simplicité et la structure du texte (Score 0-100).
3. ENGAGEMENT : Évalue la capacité à captiver l'apprenant (Score 0-100).
4. QUESTIONS SOCRATIQUES : Propose 3 questions qui poussent l'élève à réfléchir plus loin au lieu de simplement lire.
5. BLOCS SUGGÉRÉS : Recommande 3 types de composants (Quiz, Code, Math, Note, Exemple) pour dynamiser la notion.

TON : Professionnel, encourageant, mais exigeant sur la qualité didactique.

FORMAT JSON STRICT EXIGÉ :
{
  "clarityScore": number,
  "engagementScore": number,
  "bloomLevel": "Mémoriser" | "Comprendre" | "Appliquer" | "Analyser" | "Évaluer" | "Créer",
  "suggestions": ["Question 1", "Question 2", "Question 3"],
  "recommendedBlocks": ["Quiz" | "Code" | "Math" | "Note" | "Exemple"]
}`;

        const prompt = `<s>[INST] ${systemPrompt}\n\nVoici le contenu pédagogique à auditer :
---
${content.substring(0, 4000)}
---
Génère l'audit JSON maintenant. [/INST]`;

        console.log("[Socrate AI] Calling HF API...");

        // Use textGeneration instead of chatCompletion for wider model support on shared HF endpoints
        const response = await hf.textGeneration({
            model: "mistralai/Mistral-7B-Instruct-v0.2", // More stable on HF free/shared
            inputs: prompt,
            parameters: {
                max_new_tokens: 1000,
                temperature: 0.1,
                return_full_text: false,
            }
        });

        const rawContent = response.generated_text || "{}";
        console.log("[Socrate AI] Raw Response received");

        // Robust JSON extraction
        let auditResult;
        try {
            const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
            const cleanJson = jsonMatch ? jsonMatch[0] : rawContent;
            auditResult = JSON.parse(cleanJson);
        } catch (e) {
            console.error("[Socrate AI] JSON Parse Fail:", rawContent);
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

        // Special handle for Model loading / busy
        if (error.message?.includes("loading") || error.message?.includes("busy")) {
            return successResponse("IA en cours d'éveil (Réessayez dans 20s)", {
                clarityScore: 0,
                engagementScore: 0,
                bloomLevel: "Chargement...",
                suggestions: ["L'IA est en train d'être chargée sur les serveurs. Merci de patienter quelques secondes et de relancer l'analyse."],
                recommendedBlocks: []
            });
        }

        return serverErrorResponse("Erreur lors de l'audit AI", error.message);
    }
}
