import { tool, zodSchema, stepCountIs } from 'ai';
import { z } from 'zod';

export { stepCountIs };

export const AGENT_SYSTEM_PROMPT = `Tu es l'Agent IA de production d'XCCM (eXtended Content Composition Module).

### TA MISSION
Tu construis des cours et des exercices de manière AUTONOME. L'utilisateur te confie une mission ; tu exécutes via tes outils sans demander de confirmation intermédiaire.

### TES OUTILS
1. **create_structure** — Construire un cours. Arborescence (Parties → Chapitres → Paragraphes → Notions) avec contenu pédagogique RICHE
2. **write_content** — Rédiger ou réécrire le contenu d'une notion
3. **create_exercise** — Générer un exercice rattaché à une notion (QCU, QCM, QRO, FILL_BLANKS, CODE)

### MOTS-CLÉS EXERCICES (déclenche create_exercise)
exercice(s), quiz, QCM, QCU, QRO, texte(s) à trous, évaluation, évaluation formative

### TYPES D'EXERCICES
- **QCU** — une seule bonne réponse (options avec un seul isCorrect: true)
- **QCM** — plusieurs bonnes réponses possibles
- **QRO** — réponse ouverte courte (expectedAnswer)
- **FILL_BLANKS** — texte à trous (parameters.text avec des ___ pour les trous)
- **CODE** — exercice de code (si demandé explicitement)

### RÈGLES AGENT
- Demande de COURS → create_structure immédiatement (JAMAIS un plan texte seul)
- Demande d'EXERCICES → create_exercise (un appel par exercice), avec notionPath obligatoire
- Demande COURS + EXERCICES → d'abord create_structure, puis create_exercise pour les notions créées
- Le mot « complet » n'est PAS requis
- Chaque partie, chapitre et paragraphe DOIT avoir un champ intro (HTML, 2-3 phrases)
- Chaque notion DOIT avoir du contenu HTML (p, strong, ul, li, h3) — 80 à 120 mots
- Pour chaque exercice : title clair, type exact, parameters complets, notionPath (partTitle, chapterTitle, paraName, notionName)
- COMPLÉTER le projet existant, ne jamais supprimer l'existant
- Contenu en français
- 2 lignes de plan max, pas de longue prose avant les outils
`;

export type AgentIntent = {
  wantsCourse: boolean;
  wantsExercises: boolean;
  exerciseTypes: Array<'QCU' | 'QCM' | 'QRO' | 'QROA' | 'CODE' | 'FILL_BLANKS'>;
};

/** Détecte si l'utilisateur demande un cours, des exercices, ou les deux. */
export function detectAgentIntent(prompt: string): AgentIntent {
  const lower = (prompt || '').toLowerCase();

  const wantsExercises = /exercice|exercices|quiz|qcm|qcu|qro|texte[s]?\s*à\s*trous|texte[s]?\s*a\s*trous|fill[\s_-]?blank|évaluation|evaluation formative|auto[\s-]?évaluation/i.test(lower);

  const wantsCourse = /cours|structure|partie|chapitre|paragraphe|notion|construis|construire|génère un cours|genere un cours|créer un cours|cree un cours|module|leçon|lecon|contenu pédagogique|contenu pedagogique/i.test(lower)
    || (!wantsExercises);

  const exerciseTypes: AgentIntent['exerciseTypes'] = [];
  if (/\bqcu\b/i.test(lower)) exerciseTypes.push('QCU');
  if (/\bqcm\b/i.test(lower)) exerciseTypes.push('QCM');
  if (/\bqro\b/i.test(lower)) exerciseTypes.push('QRO');
  if (/texte[s]?\s*à\s*trous|texte[s]?\s*a\s*trous|fill[\s_-]?blank/i.test(lower)) {
    exerciseTypes.push('FILL_BLANKS');
  }
  if (/\bcode\b/i.test(lower) && wantsExercises) exerciseTypes.push('CODE');

  if (wantsExercises && exerciseTypes.length === 0) {
    exerciseTypes.push('QCM', 'QRO', 'FILL_BLANKS');
  }

  return {
    wantsCourse: wantsCourse || !wantsExercises,
    wantsExercises,
    exerciseTypes,
  };
}

export function hasExerciseActions(
  actions: Array<{ type: string; data: unknown }>
): boolean {
  return actions.some((a) => a.type === 'create_exercise');
}

/** Liste les notions d'une action create_structure pour le 2e passage exercices. */
export function listNotionsFromStructureActions(
  actions: Array<{ type: string; data: unknown }>
): Array<{ partTitle: string; chapterTitle: string; paraName: string; notionName: string }> {
  const out: Array<{ partTitle: string; chapterTitle: string; paraName: string; notionName: string }> = [];
  for (const action of actions) {
    if (action.type !== 'create_structure') continue;
    const parts = (action.data as { parts?: Array<Record<string, unknown>> })?.parts || [];
    for (const part of parts) {
      const partTitle = String(part.title || part.part_title || '').trim();
      for (const ch of (part.chapters as Array<Record<string, unknown>>) || []) {
        const chapterTitle = String(ch.title || ch.chapter_title || '').trim();
        for (const para of (ch.paragraphs as Array<Record<string, unknown>>) || []) {
          const paraName = String(para.title || para.para_name || '').trim();
          for (const n of (para.notions as Array<Record<string, unknown>>) || []) {
            const notionName = String(n.title || n.notion_name || '').trim();
            if (partTitle && chapterTitle && paraName && notionName) {
              out.push({ partTitle, chapterTitle, paraName, notionName });
            }
          }
        }
      }
    }
  }
  return out;
}

/** Contraintes supplémentaires pour l'endpoint agent (limites Vercel / latence Mistral) */
export const AGENT_PERFORMANCE_SUFFIX = `
### CONTRAINTES DE GÉNÉRATION (OBLIGATOIRE)
- 1 à 2 parties, 2 chapitres max par partie, 2 paragraphes max, 2 notions max par paragraphe
- intro OBLIGATOIRE (HTML) sur partie, chapitre et paragraphe
- Contenu HTML dans chaque notion (80 à 120 mots)
- UN SEUL appel create_structure avec toute l'arborescence
- Exercices : 2 à 6 max, un create_exercise par exercice, notionPath obligatoire
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
  content: z.string().min(50).describe('Contenu pédagogique HTML obligatoire (p, strong, ul, li, h3) — minimum 80 mots'),
});

const paragraphSchema = z.object({
  title: z.string().describe('Titre du paragraphe'),
  intro: z.string().min(20).describe('Introduction HTML obligatoire du paragraphe (1-2 phrases)'),
  notions: z.array(notionSchema).min(1).describe('Notions du paragraphe'),
});

const chapterSchema = z.object({
  title: z.string().describe('Titre du chapitre'),
  intro: z.string().min(20).describe('Introduction HTML obligatoire du chapitre (2-3 phrases)'),
  paragraphs: z.array(paragraphSchema).min(1).describe('Paragraphes du chapitre'),
});

const partSchema = z.object({
  title: z.string().describe('Titre de la partie'),
  intro: z.string().min(20).describe('Introduction HTML obligatoire de la partie (2-3 phrases)'),
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
  type: z.enum(['QCU', 'QCM', 'QRO', 'QROA', 'CODE', 'FILL_BLANKS'])
    .describe('QCU = une bonne réponse, QCM = plusieurs, QRO = ouverte, FILL_BLANKS = texte à trous'),
  title: z.string().describe('Titre court de l\'exercice'),
  notionPath: z.object({
    partTitle: z.string(),
    chapterTitle: z.string(),
    paraName: z.string(),
    notionName: z.string(),
  }).describe('Notion cible — OBLIGATOIRE pour afficher l\'exercice dans le panneau'),
  parameters: z.object({
    question: z.string().optional().describe('Énoncé (QCU/QCM/QRO)'),
    options: z.array(z.object({
      id: z.string(),
      text: z.string(),
      isCorrect: z.boolean(),
    })).optional().describe('Options pour QCU/QCM'),
    expectedAnswer: z.string().optional().describe('Réponse attendue (QRO)'),
    evaluationPrompt: z.string().optional(),
    text: z.string().optional().describe('Texte avec ___ pour FILL_BLANKS'),
    blanks: z.array(z.object({
      id: z.string(),
      answer: z.string(),
    })).optional().describe('Réponses des trous (FILL_BLANKS)'),
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
      description:
        'Crée un exercice (QCU, QCM, QRO, FILL_BLANKS, CODE) rattaché à une notion via notionPath. '
        + 'Un appel = un exercice. Types : QCU (1 bonne réponse), QCM (plusieurs), QRO (ouverte), FILL_BLANKS (texte à trous).',
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

/** Vérifie que la structure contient intros et contenus réels (pas des squelettes) */
export function hasRichStructureContent(
  actions: Array<{ type: string; data: unknown }>
): boolean {
  const structure = actions.find((a) => a.type === 'create_structure');
  if (!structure) return false;

  const data = structure.data as { parts?: Array<Record<string, unknown>> } | null;
  const parts = data?.parts;
  if (!Array.isArray(parts) || parts.length === 0) return false;

  const strip = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = (s: string) => (strip(s) ? strip(s).split(/\s+/).length : 0);

  for (const part of parts) {
    const partIntro = String(part.intro || part.part_intro || '');
    if (strip(partIntro).length < 15) return false;

    const chapters = (part.chapters as Array<Record<string, unknown>>) || [];
    for (const ch of chapters) {
      const chIntro = String(ch.intro || ch.chapter_intro || '');
      if (strip(chIntro).length < 15) return false;

      const paragraphs = (ch.paragraphs as Array<Record<string, unknown>>) || [];
      for (const para of paragraphs) {
        const paraIntro = String(para.intro || para.para_intro || '');
        if (strip(paraIntro).length < 10) return false;

        const notions = (para.notions as Array<Record<string, unknown>>) || [];
        for (const n of notions) {
          const content = String(n.content || n.notion_content || n.body || '');
          if (wordCount(content) < 30) return false;
        }
      }
    }
  }

  return true;
}
