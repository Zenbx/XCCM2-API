import { tool, zodSchema, stepCountIs } from 'ai';
import { z } from 'zod';

export { stepCountIs };

export const AGENT_SYSTEM_PROMPT = `Tu es l'Agent IA de production d'XCCM (eXtended Content Composition Module).

### TA MISSION
Tu construis des cours complets de manière AUTONOME. L'utilisateur te confie une mission ; tu exécutes via tes outils sans demander de confirmation intermédiaire.

### TES OUTILS
1. **create_structure** — OBLIGATOIRE pour construire un cours. Arborescence complète (Parties → Chapitres → Paragraphes → Notions) avec contenu pédagogique RICHE dans chaque notion
2. **write_content** — Rédiger ou réécrire le contenu d'une notion
3. **create_exercise** — Générer des exercices (QCU, QCM, QRO, texte à trous, code)

### RÈGLES AGENT
- Toute demande de création/construction de cours → appelle IMMÉDIATEMENT create_structure (JAMAIS un plan texte seul)
- Le mot « complet » n'est PAS requis : « Construis un cours sur X » suffit
- Chaque partie, chapitre et paragraphe DOIT avoir un champ intro (HTML, 2-3 phrases)
- Chaque notion DOIT avoir du contenu HTML (p, strong, ul, li, h3) — 80 à 120 mots
- COMPLÉTER le projet existant, ne jamais supprimer l'existant
- Contenu en français
- Appelle create_structure dans le PREMIER tour (2 lignes de plan max, pas de longue prose avant l'outil)
`;

/** Contraintes supplémentaires pour l'endpoint agent (limites Vercel / latence Mistral) */
export const AGENT_PERFORMANCE_SUFFIX = `
### CONTRAINTES DE GÉNÉRATION (OBLIGATOIRE)
- 1 à 2 parties, 2 chapitres max par partie, 2 paragraphes max, 2 notions max par paragraphe
- intro OBLIGATOIRE (HTML) sur partie, chapitre et paragraphe
- Contenu HTML dans chaque notion (80 à 120 mots)
- UN SEUL appel create_structure avec toute l'arborescence
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

const notionSchema = z.object({
  title: z.string().describe('Titre de la notion'),
  content: z.string().describe('Contenu pédagogique HTML (p, strong, ul, li, h3)'),
});

const paragraphSchema = z.object({
  title: z.string().describe('Titre du paragraphe'),
  intro: z.string().describe('Introduction HTML du paragraphe (1-2 phrases)'),
  notions: z.array(notionSchema).min(1).describe('Notions du paragraphe'),
});

const chapterSchema = z.object({
  title: z.string().describe('Titre du chapitre'),
  intro: z.string().describe('Introduction HTML du chapitre (2-3 phrases)'),
  paragraphs: z.array(paragraphSchema).min(1).describe('Paragraphes du chapitre'),
});

const partSchema = z.object({
  title: z.string().describe('Titre de la partie'),
  intro: z.string().describe('Introduction HTML de la partie (2-3 phrases)'),
  chapters: z.array(chapterSchema).min(1).describe('Chapitres de la partie'),
});

const createStructureSchema = z.object({
  parts: z.array(partSchema).min(1).max(4).describe('Parties du cours'),
});

const writeContentSchema = z.object({
  content: z.string().describe('Contenu pédagogique à écrire'),
  target: z.enum(['current', 'notion']).describe("'current' pour l'éditeur actif"),
  notionPath: z.object({
    partTitle: z.string(),
    chapterTitle: z.string(),
    paraName: z.string(),
    notionName: z.string(),
  }).optional(),
});

const createExerciseSchema = z.object({
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
    text: z.string().optional(),
  }),
  settings: z.object({
    isBlocking: z.boolean().optional(),
    maxAttempts: z.number().optional(),
    points: z.number().optional(),
  }).optional(),
});

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
      description: 'Crée une structure de cours complète avec parties, chapitres, paragraphes et notions remplies.',
      inputSchema: zodSchema(createStructureSchema),
    }),
    write_content: tool({
      description: 'Écrit ou réécrit le contenu pédagogique.',
      inputSchema: zodSchema(writeContentSchema),
    }),
    create_exercise: tool({
      description: 'Crée un exercice pédagogique.',
      inputSchema: zodSchema(createExerciseSchema),
    }),
  };
}

type ToolCallLike = {
  toolName: string;
  input?: unknown;
  args?: unknown;
  invalid?: boolean;
};

export function toolCallData(tc: ToolCallLike): unknown {
  if (tc.invalid) return null;
  return tc.input !== undefined && tc.input !== null ? tc.input : tc.args;
}

export function extractActionsFromResult(result: {
  text?: string;
  toolCalls?: ToolCallLike[];
  steps?: Array<{ toolCalls?: ToolCallLike[] }>;
}) {
  const actions: Array<{ type: string; data: unknown; status: string }> = [];

  const push = (tc: ToolCallLike) => {
    const data = toolCallData(tc);
    if (data === null || data === undefined) return;
    actions.push({ type: tc.toolName, data, status: 'pending' });
  };

  if (result.steps) {
    for (const step of result.steps) {
      step.toolCalls?.forEach(push);
    }
  }

  result.toolCalls?.forEach((tc) => {
    const data = toolCallData(tc);
    if (data === null || data === undefined) return;
    const exists = actions.some(
      (a) => a.type === tc.toolName && JSON.stringify(a.data) === JSON.stringify(data)
    );
    if (!exists) push(tc);
  });

  return actions;
}

/** Vérifie qu'au moins une action create_structure contient des parties valides */
export function hasValidStructureActions(
  actions: Array<{ type: string; data: unknown }>
): boolean {
  return actions.some((a) => {
    if (a.type !== 'create_structure') return false;
    const data = a.data as { parts?: unknown[] } | null;
    return Array.isArray(data?.parts) && data!.parts.length > 0;
  });
}
