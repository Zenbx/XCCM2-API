/**
 * Service de chatbot pédagogique pour reformuler des Notions.
 * Utilise le SDK Mistral AI pour produire des reformulations adaptées aux apprenants.
 */

import { generateText } from 'ai';
import { mistral } from '@ai-sdk/mistral';

/**
 * Styles supportés par le service de reformulation.
 */
export type RephraseStyle =
    | "simple"
    | "formal"
    | "french"
    | "english"
    | "summary"
    | "detailed"
    | (string & {});

export interface RephraseOptions {
    style: RephraseStyle;
}

/**
 * Construit un prompt pédagogique détaillé pour la reformulation.
 */
function buildPedagogicalPrompt(content: string, style: RephraseStyle): {
    system: string;
    user: string;
} {
    const baseSystemPrompt = [
        "Tu es un expert en pédagogie et en vulgarisation.",
        "Tu aides à reformuler des contenus éducatifs pour les rendre clairs, précis et engageants.",
        "Tu respectes toujours le sens exact du contenu d'origine et tu évites d'inventer des informations.",
        "Tu écris dans un style adapté au niveau d'un étudiant de premier cycle universitaire.",
    ].join(" ");

    let styleInstruction: string;

    switch (style) {
        case "simple":
            styleInstruction =
                "Reformule le contenu dans un langage simple, accessible et concret. " +
                "Utilise des phrases courtes, des exemples parlants et évite le jargon technique.";
            break;

        case "formal":
            styleInstruction =
                "Reformule le contenu dans un style formel et académique, en conservant une structure claire et rigoureuse.";
            break;

        case "french":
            styleInstruction =
                "Reformule le contenu en français clair et naturel, en veillant à la correction grammaticale et à la fluidité.";
            break;

        case "english":
            styleInstruction =
                "Rewrite the content in clear and natural English, suitable for higher education students.";
            break;

        case "summary":
            styleInstruction =
                "Produis une version résumée du contenu, en gardant uniquement les idées clés, sous forme de texte continu.";
            break;

        case "detailed":
            styleInstruction =
                "Développe le contenu avec davantage de détails, d'explications et, si utile, de petites analogies simples.";
            break;

        default:
            styleInstruction =
                `Adapte la reformulation au style suivant : "${style}". ` +
                "Garde un ton pédagogique, clair et structuré.";
            break;
    }

    const userPrompt = [
        styleInstruction,
        "",
        "Rappels importants :",
        "- Ne perds pas les nuances importantes pour la compréhension du concept.",
        "- Ne rajoute pas de faits nouveaux qui ne sont pas présents dans le texte.",
        "- Si le texte contient des termes techniques, explique-les brièvement si nécessaire.",
        "",
        "Contenu à reformuler :",
        "```",
        content,
        "```",
    ].join("\n");

    return {
        system: baseSystemPrompt,
        user: userPrompt,
    };
}

/**
 * Reformule le contenu d'une Notion via Mistral AI.
 *
 * @param content - Texte brut de la Notion (notion_content)
 * @param options - Options de reformulation (style, langue, niveau, etc.)
 * @returns Texte reformulé
 */
export async function rephraseNotion(
    content: string,
    options: RephraseOptions
): Promise<string> {
    if (!content || !content.trim()) {
        throw new Error("Content is empty");
    }

    const { system, user } = buildPedagogicalPrompt(content, options.style);

    try {
        console.log("[chatbot] RephraseNotion called with style:", options.style);

        const { text } = await generateText({
            model: mistral('mistral-small-latest'), // Small is fast and sufficient for rephrasing
            system: system,
            prompt: user,
            temperature: 0.4,
            maxTokens: 1000,
        });

        const trimmedText = text.trim();

        if (!trimmedText) {
            throw new Error("Empty response from Mistral AI");
        }

        return trimmedText;

    } catch (error: any) {
        console.error("[chatbot] Erreur lors de la reformulation de la Notion :", error);
        throw new Error(`Failed to rephrase notion content: ${error.message}`);
    }
}