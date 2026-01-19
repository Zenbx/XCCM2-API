import { InferenceClient } from "@huggingface/inference";

/**
 * Interface pour le résultat de l'audit Socratique.
 */
export interface SocraticAuditResult {
    clarityScore: number;     // 0-100
    bloomLevel: string;       // "Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"
    engagementScore: number;  // 0-100
    suggestions: string[];    // Liste de conseils textuels
    recommendedBlocks: string[]; // ["quiz", "code", "math", "image", "note"]
    revisedText?: string;     // Optionnel, une version améliorée du texte
}

let hfClient: InferenceClient | null = null;

function getHfClient(): InferenceClient {
    if (!process.env.HF_API_TOKEN) {
        throw new Error("HF_API_TOKEN is not defined");
    }
    if (!hfClient) {
        hfClient = new InferenceClient(process.env.HF_API_TOKEN);
    }
    return hfClient;
}

const DEFAULT_HF_MODEL = "meta-llama/Meta-Llama-3-8B-Instruct";

/**
 * Analyse le contenu d'une notion d'un point de vue pédagogique.
 */
export async function auditPedagogy(content: string): Promise<SocraticAuditResult> {
    if (!content || !content.trim()) {
        throw new Error("Content is empty");
    }

    const hf = getHfClient();
    const model = process.env.HF_MODEL_ID || DEFAULT_HF_MODEL;

    const systemPrompt = `Tu es Socrate, un expert en design pédagogique et en ingénierie de formation.
Ton rôle est d'auditer le contenu d'un cours pour aider l'auteur à le rendre exceptionnel.
Analyse le texte selon : la clarté, le niveau de la taxonomie de Bloom, et l'engagement.

Tu DOIS répondre uniquement au format JSON valide, sans texte avant ou après.
Format attendu :
{
  "clarityScore": number,
  "bloomLevel": "string",
  "engagementScore": number,
  "suggestions": ["string"],
  "recommendedBlocks": ["quiz" | "code" | "math" | "image" | "note"]
}`;

    const userPrompt = `Analyse ce contenu pédagogique :
---
${content}
---
Donne ton audit au format JSON.`;

    try {
        const response = await hf.chatCompletion({
            model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            max_tokens: 800,
            temperature: 0.2, // Faible température pour plus de cohérence JSON
        });

        const text = response.choices[0]?.message?.content?.trim() || "";

        // Nettoyage du texte si le modèle ajoute des markdown blocks
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : text;

        try {
            const result = JSON.parse(jsonStr) as SocraticAuditResult;
            return result;
        } catch (parseError) {
            console.error("[socratic-ai] Erreur de parsing JSON:", text);
            throw new Error("Le modèle AI n'a pas renvoyé un format JSON valide.");
        }

    } catch (error: any) {
        console.error("[socratic-ai] Erreur lors de l'audit :", error);
        throw new Error(`Échec de l'audit Socratique : ${error.message}`);
    }
}
