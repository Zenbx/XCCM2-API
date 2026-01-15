/**
 * Service de chatbot pédagogique pour reformuler des Notions.
 *
 * Utilise la Hugging Face Inference API (client officiel `@huggingface/inference`)
 * et un prompt engineering orienté éducation pour produire des reformulations
 * adaptées aux apprenant·e·s.
 *
 * ⚠️ Prérequis :
 * - Installer la dépendance : `npm install @huggingface/inference`
 * - Définir la variable d'environnement : `HF_API_TOKEN`
 */

import { InferenceClient } from "@huggingface/inference";

/**
 * Styles supportés par le service de reformulation.
 *
 * Tu peux en ajouter d'autres facilement (par ex. "story", "quiz", etc.).
 */
export type RephraseStyle =
    | "simple"
    | "formal"
    | "french"
    | "english"
    | "summary"
    | "detailed"
    | (string & {}); // permet des valeurs personnalisées sans casser le typage

export interface RephraseOptions {
    style: RephraseStyle;
}

/**
 * Instance Hugging Face Inference.
 *
 * On la crée paresseusement pour éviter des erreurs si le token n'est pas défini
 * au moment du chargement du module.
 */
let hfClient: InferenceClient | null = null;

function getHfClient(): InferenceClient {
    if (!process.env.HF_API_TOKEN) {
        console.error(
            "[chatbot] La variable d'environnement HF_API_TOKEN est manquante. " +
            "La reformulation ne pourra pas fonctionner."
        );
        throw new Error("HF_API_TOKEN is not defined");
    }

    if (!hfClient) {
        // ✅ Utilisation de l'endpoint par défaut de la bibliothèque
        // La bibliothèque @huggingface/inference gère automatiquement
        // le routage vers le bon endpoint selon la tâche
        hfClient = new InferenceClient(process.env.HF_API_TOKEN);

        console.log("[chatbot] Client Hugging Face initialisé");
    }

    return hfClient;
}

/**
 * Construit un prompt pédagogique détaillé pour la reformulation.
 *
 * On sépare :
 * - un "system prompt" décrivant le rôle du modèle,
 * - un "user prompt" avec la consigne concrète.
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

    // Adaptation du style demandé
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
 * Modèle Hugging Face utilisé pour la reformulation.
 *
 * Tu peux le rendre configurable via une variable d'environnement
 * (par ex. HF_MODEL_ID) si besoin.
 */
const DEFAULT_HF_MODEL = "meta-llama/Meta-Llama-3-8B-Instruct";

/**
 * Reformule le contenu d'une Notion via un modèle LLM hébergé sur Hugging Face.
 *
 * @param content - Texte brut de la Notion (notion_content)
 * @param options - Options de reformulation (style, langue, niveau, etc.)
 * @returns Texte reformulé
 *
 * En cas d'erreur, lève une exception pour que la route API puisse renvoyer
 * une réponse d'erreur appropriée.
 */
export async function rephraseNotion(
    content: string,
    options: RephraseOptions
): Promise<string> {
    if (!content || !content.trim()) {
        throw new Error("Content is empty");
    }

    const hf = getHfClient();
    const { system, user } = buildPedagogicalPrompt(content, options.style);

    try {
        console.log("[chatbot] RephraseNotion called with style:", options.style);

        const model = process.env.HF_MODEL_ID || DEFAULT_HF_MODEL;

        // ✅ Utilise chatCompletion pour les modèles Instruct/Chat
        console.log("📨 Calling HuggingFace chatCompletion...");

        const response = await hf.chatCompletion({
            model,
            messages: [
                { role: "system", content: system },
                { role: "user", content: user }
            ],
            max_tokens: 512,
            temperature: 0.4,
        });

        console.log("✅ HuggingFace response received");

        const text = response.choices[0]?.message?.content?.trim() || "";

        if (!text) {
            console.error(
                "[chatbot] Réponse vide ou invalide du modèle Hugging Face",
                JSON.stringify(response, null, 2)
            );
            throw new Error("Empty response from Hugging Face model");
        }

        return text;

    } catch (error: any) {
        console.error("[chatbot] Erreur lors de la reformulation de la Notion :", error);
        console.error("Status:", error.status || error.statusCode);
        console.error("Message:", error.message);

        // On re-lance l'erreur pour que la route API décide du message à renvoyer
        if (error instanceof Error) {
            throw new Error(
                `Failed to rephrase notion content: ${error.message}`
            );
        }

        throw new Error("Failed to rephrase notion content: unknown error");
    }
}