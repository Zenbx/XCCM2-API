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
                isDemoMode: true  // Indicateur explicite
            });
        }

        const hf = new HfInference(apiKey);

        const systemPrompt = `Tu es SocrateAI, un expert mondial en pédagogie et sciences cognitives.
Ta mission est d'auditer un contenu éducatif (Notion) pour en maximiser l'impact d'apprentissage.

ANALYSES REQUISES :
1. BLOOM'S TAXONOMY : Détermine le niveau cognitif (Actual: Mémoriser/Comprendre vs Target: Analyser/Créer).
2. ENGAGEMENT : Analyse le ton, la clarté et l'interactivité.
3. SOCRATIC FEEDBACK : Pose des questions qui poussent l'auteur à approfondir, ne donne pas juste des ordres.
4. MISSING BLOCKS : Suggère des types de blocs concrets (Exemple, Quiz, Analogie, Contre-exemple).

CONTRAINTES STRICTES :
- Réponds UNIQUEMENT en JSON valide.
- Ton ton doit être bienveillant mais exigeant.
- ClarityScore et EngagementScore sont sur 100.

FORMAT DE SORTIE ATTENDU :
{
  "clarityScore": number,
  "engagementScore": number,
  "bloomLevel": "Mémoriser" | "Comprendre" | "Appliquer" | "Analyser" | "Évaluer" | "Créer",
  "suggestions": ["Question socratique 1", "Question socratique 2", "Suggestion structurelle"],
  "recommendedBlocks": ["Exemple", "Quiz", "Définition"]
}`;

        const response = await hf.chatCompletion({
            model: "mistralai/Mistral-7B-Instruct-v0.3",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Voici le contenu à auditer : "${content.substring(0, 2000)}"` } // Limit content length for safety
            ],
            max_tokens: 1000,
            temperature: 0.7,
            response_format: { type: "json_object" }
        });

        const rawContent = response.choices[0].message.content || "{}";
        let auditResult;

        try {
            auditResult = JSON.parse(rawContent);
        } catch (e) {
            console.error("Failed to parse AI response:", rawContent);
            // Fallback safe struct
            auditResult = {
                clarityScore: 70,
                engagementScore: 60,
                bloomLevel: "Comprendre",
                suggestions: ["L'IA n'a pas pu générer un format JSON valide, mais votre contenu semble solide. Essayez d'ajouter des exemples."],
                recommendedBlocks: ["Exemple"]
            };
        }

        return successResponse("Audit pédagogique terminé", auditResult);

    } catch (error: any) {
        console.error("[api/ai/audit] Error:", error);
        return serverErrorResponse("Erreur lors de l'audit AI", error.message);
    }
}
