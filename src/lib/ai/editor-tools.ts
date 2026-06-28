import { tool } from 'ai';
import { z } from 'zod';

export const AGENT_SYSTEM_PROMPT = `Tu es l'Agent IA de production d'XCCM (eXtended Content Composition Module).

### TA MISSION
Tu construis des cours complets de manière AUTONOME. L'utilisateur te confie une mission ; tu exécutes via tes outils sans demander de confirmation intermédiaire.

### TES OUTILS
1. **create_structure** — Arborescence complète (Parties → Chapitres → Paragraphes → Notions) avec contenu pédagogique RICHE dans chaque notion
2. **write_content** — Rédiger ou réécrire le contenu d'une notion
3. **create_exercise** — Générer des exercices (QCU, QCM, QRO, texte à trous, code)

### RÈGLES AGENT
- Quand l'utilisateur demande de CONSTRUIRE / CRÉER un cours complet → utilise create_structure avec 2 à 3 parties, 2 à 3 chapitres par partie, 2 à 3 paragraphes par chapitre, 2 à 4 notions par paragraphe
- Chaque notion DOIT contenir du contenu pédagogique substantiel (HTML simple : p, strong, em, ul, li, h3) — pas de squelettes vides
- COMPLÉTER le projet existant : ajoute de nouvelles parties/chapitres, ne supprime jamais l'existant
- Si des exercices ou QCM sont demandés → appelle create_exercise (1 par chapitre minimum si demandé)
- Appelle TOUJOURS au moins un outil pour une demande d'action — ne te contente pas de décrire
- Contenu en français sauf indication contraire
- Commence ta réponse par un plan court (3-5 lignes) puis exécute via les outils
`;

export const EDITOR_CHAT_PROMPT = `Tu es l'Assistant IA Éditeur d'XCCM (eXtended Content Composition Module).

### TA MISSION
Tu aides les auteurs à construire leurs cours en proposant des ACTIONS concrètes.

### TES OUTILS
1. **create_structure** — Créer une arborescence (Parties → Chapitres → Paragraphes → Notions)
2. **write_content** — Écrire ou réécrire le contenu pédagogique
3. **create_exercise** — Générer des exercices (QCU, QCM, QRO, texte à trous, code)

### RÈGLES
- CRÉER / STRUCTURER → create_structure
- ÉCRIRE / RÉDIGER → write_content
- QUIZ / QCM / EXERCICE → create_exercise
- Contenu riche et pédagogique, pas des squelettes
- Appelle un outil quand l'utilisateur demande une action
`;

export function buildContextBlock(context: Record<string, unknown> | undefined): string {
  return `
### CONTEXTE ACTUEL
Projet : ${context?.projectName || 'Non spécifié'}
Partie : ${context?.partTitle || 'Non spécifiée'}
Chapitre : ${context?.chapterTitle || 'Non spécifié'}
Paragraphe : ${context?.paraName || 'Non spécifié'}
Notion : ${context?.notionName || 'Non spécifiée'}
Contenu actuel de l'éditeur :
${typeof context?.notionContent === 'string' ? context.notionContent.substring(0, 2000) : 'Vide'}
`;
}

export function getEditorTools() {
  return {
    create_structure: tool({
      description: 'Crée une structure de cours complète avec parties, chapitres, paragraphes et notions.',
      parameters: z.object({
        parts: z.array(z.object({
          title: z.string().describe('Titre de la partie'),
          intro: z.string().optional().describe('Introduction de la partie'),
          chapters: z.array(z.object({
            title: z.string().describe('Titre du chapitre'),
            intro: z.string().optional().describe('Introduction du chapitre'),
            paragraphs: z.array(z.object({
              title: z.string().describe('Titre du paragraphe'),
              intro: z.string().optional(),
              notions: z.array(z.object({
                title: z.string().describe('Titre de la notion'),
                content: z.string().describe('Contenu pédagogique HTML'),
              })).optional(),
            })).optional(),
          })).optional(),
        })),
      }),
    }),
    write_content: tool({
      description: 'Écrit ou réécrit le contenu pédagogique.',
      parameters: z.object({
        content: z.string().describe('Le contenu pédagogique à écrire'),
        target: z.enum(['current', 'notion']).describe("'current' pour l'éditeur actif, 'notion' pour une notion spécifique"),
        notionPath: z.object({
          partTitle: z.string(),
          chapterTitle: z.string(),
          paraName: z.string(),
          notionName: z.string(),
        }).optional(),
      }),
    }),
    create_exercise: tool({
      description: 'Crée un exercice pédagogique.',
      parameters: z.object({
        type: z.enum(['QCU', 'QCM', 'QRO', 'QROA', 'CODE', 'FILL_BLANKS']),
        title: z.string(),
        parameters: z.object({
          question: z.string().optional(),
          options: z.array(z.object({
            id: z.string(),
            text: z.string(),
            isCorrect: z.boolean(),
          })).optional(),
          expectedAnswer: z.string().optional(),
          evaluationPrompt: z.string().optional(),
          text: z.string().optional().describe('Texte à trous avec {{mot}}'),
        }),
        settings: z.object({
          isBlocking: z.boolean().optional(),
          maxAttempts: z.number().optional(),
          points: z.number().optional(),
        }).optional(),
      }),
    }),
  };
}

export function extractActionsFromResult(result: {
  text?: string;
  toolCalls?: Array<{ toolName: string; args: unknown }>;
  steps?: Array<{ toolCalls?: Array<{ toolName: string; args: unknown }> }>;
}) {
  const actions: Array<{ type: string; data: unknown; status: string }> = [];

  if (result.steps) {
    for (const step of result.steps) {
      if (step.toolCalls) {
        for (const tc of step.toolCalls) {
          actions.push({ type: tc.toolName, data: tc.args, status: 'pending' });
        }
      }
    }
  }

  if (result.toolCalls?.length) {
    for (const tc of result.toolCalls) {
      const exists = actions.some(
        (a) => a.type === tc.toolName && JSON.stringify(a.data) === JSON.stringify(tc.args)
      );
      if (!exists) {
        actions.push({ type: tc.toolName, data: tc.args, status: 'pending' });
      }
    }
  }

  return actions;
}
