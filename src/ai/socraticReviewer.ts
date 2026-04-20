import { generateText } from 'ai';
import { mistral } from '@ai-sdk/mistral';

export interface PedagogicalFeedback {
    id: string;
    sentenceStart: number;
    sentenceEnd: number;
    text: string;
    highlightColor: 'yellow' | 'orange' | 'red';
    severity: 'info' | 'warning' | 'error';
    category: 'circular_definition' | 'missing_example' | 'too_abstract' | 'passive_voice' | 'complexity';
    comment: string;
    suggestions: string[];
}

export interface BloomScore {
    remember: number;
    understand: number;
    apply: number;
    analyze: number;
    evaluate: number;
    create: number;
    dominant: string;
    recommendation: string;
}

export class SocraticReviewer {

    /**
     * Analyse complète du contenu pédagogique
     */
    async analyzeContent(text: string): Promise<PedagogicalFeedback[]> {
        if (!text || text.length < 50) return [];

        const systemPrompt = `Tu es un expert en pédagogie et didactique. Ton rôle est d'améliorer la qualité des contenus éducatifs.
Analyse le texte fourni et identifie les problèmes pédagogiques spécifiques :

1. Définitions circulaires (le mot défini est utilisé dans la définition)
2. Manque d'exemples concrets pour les concepts abstraits
3. Phrase trop complexe ou voix passive excessive
4. Ton trop académique ou manque d'engagement

Réponds UNIQUEMENT avec un tableau JSON valide contenant la liste des problèmes détectés.
Si aucun problème, renvoie un tableau vide [].

Format attendu pour chaque objet du tableau :
{
  "text": "l'extrait exact du texte original qui pose problème (doit être un court passage)",
  "category": "circular_definition" | "missing_example" | "too_abstract" | "complexity",
  "comment": "Explication courte et constructive du problème (en français)",
  "suggestions": ["Suggestion d'amélioration 1", "Suggestion 2"],
  "severity": "info" | "warning" | "error"
}`;

        try {
            const { text: result } = await generateText({
                model: mistral('mistral-medium-latest'),
                system: systemPrompt,
                prompt: `Texte à analyser : """${text}"""`,
                temperature: 0.1,
            });

            return this.processFeedback(result, text);
        } catch (error) {
            console.error("SocraticReviewer Error:", error);
            return [];
        }
    }

    /**
     * Calcul du score Bloom
     */
    async scoreBloomTaxonomy(text: string): Promise<BloomScore> {
        if (!text || text.length < 50) return this.getDefaultBloomScore();

        const systemPrompt = `Évalue le niveau cognitif de ce contenu pédagogique selon la Taxonomie de Bloom.
Donne un score sur 100 pour chaque niveau : Remember, Understand, Apply, Analyze, Evaluate, Create.
Détermine le niveau dominant et une recommandation courte pour élever le niveau.

Réponds UNIQUEMENT avec ce JSON :
{
  "remember": 0-100,
  "understand": 0-100,
  "apply": 0-100,
  "analyze": 0-100,
  "evaluate": 0-100,
  "create": 0-100,
  "dominant": "Nom du niveau dominant",
  "recommendation": "Conseil court"
}`;

        try {
            const { text: result } = await generateText({
                model: mistral('mistral-medium-latest'),
                system: systemPrompt,
                prompt: `Texte : """${text}"""`,
                temperature: 0.1,
            });
            
            return JSON.parse(this.cleanJson(result));
        } catch (error) {
            console.error("BloomScore Error:", error);
            return this.getDefaultBloomScore();
        }
    }

    // --- Private Helpers ---

    private cleanJson(text: string): string {
        // Nettoyage agressif pour extraire le JSON d'une réponse verbeuse
        const jsonMatch = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
        if (jsonMatch) return jsonMatch[0];
        return text.trim();
    }

    private processFeedback(rawResponse: string, originalText: string): PedagogicalFeedback[] {
        try {
            const items = JSON.parse(this.cleanJson(rawResponse));
            if (!Array.isArray(items)) return [];

            return items.map((item: any) => {
                // Trouver la position dans le texte original
                const index = originalText.indexOf(item.text);

                return {
                    id: Math.random().toString(36).substr(2, 9),
                    sentenceStart: index >= 0 ? index : 0,
                    sentenceEnd: index >= 0 ? index + item.text.length : 0,
                    text: item.text,
                    highlightColor: this.getSeverityColor(item.severity),
                    severity: item.severity || 'info',
                    category: item.category,
                    comment: item.comment,
                    suggestions: item.suggestions || [],
                };
            }).filter(item => item.text && item.sentenceEnd > 0);
        } catch (e) {
            console.error("Failed to parse JSON feedback:", e);
            return [];
        }
    }

    private getSeverityColor(severity: string): 'yellow' | 'orange' | 'red' {
        switch (severity) {
            case 'error': return 'red';
            case 'warning': return 'orange';
            default: return 'yellow';
        }
    }

    private getDefaultBloomScore(): BloomScore {
        return {
            remember: 0, understand: 0, apply: 0, analyze: 0, evaluate: 0, create: 0,
            dominant: 'None', recommendation: 'Contenu trop court pour analyser.'
        };
    }
}
