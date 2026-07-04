/**
 * Agent IA — construction autonome de cours et d'exercices
 */
import { generateText } from 'ai';
import { mistral } from '@ai-sdk/mistral';
import {
  AGENT_PERFORMANCE_SUFFIX,
  AGENT_SYSTEM_PROMPT,
  buildContextBlock,
  detectAgentIntent,
  extractActionsFromResult,
  getEditorTools,
  hasExerciseActions,
  hasRichStructureContent,
  hasValidStructureActions,
  listNotionsFromStructureActions,
  stepCountIs,
} from '@/lib/ai/editor-tools';

/** Vercel Pro: jusqu'à 300 s. Réserver une marge avant le hard kill. */
export const maxDuration = 300;
const VERCEL_BUDGET_MS = (maxDuration - 20) * 1000;
const RETRY_MIN_REMAINING_MS = 45_000;
const EXERCISE_PASS_MIN_MS = 40_000;

type ToolChoice =
  | 'auto'
  | { type: 'tool'; toolName: 'create_structure' | 'create_exercise' };

async function runAgentGeneration(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  context: Record<string, unknown>,
  options: {
    toolChoice?: ToolChoice;
    maxSteps?: number;
    timeoutMs?: number;
  } = {}
) {
  const timeoutMs = options.timeoutMs ?? VERCEL_BUDGET_MS;
  const maxSteps = options.maxSteps ?? 2;

  return generateText({
    model: mistral('mistral-medium-latest'),
    system: AGENT_SYSTEM_PROMPT + AGENT_PERFORMANCE_SUFFIX + buildContextBlock(context),
    messages,
    tools: getEditorTools(),
    toolChoice: options.toolChoice ?? 'auto',
    stopWhen: stepCountIs(maxSteps),
    maxOutputTokens: 6144,
    abortSignal: AbortSignal.timeout(timeoutMs),
  });
}

function remainingBudgetMs(startedAt: number): number {
  return Math.max(0, VERCEL_BUDGET_MS - (Date.now() - startedAt));
}

function buildExercisePassPrompt(
  userPrompt: string,
  types: string[],
  notions: Array<{ partTitle: string; chapterTitle: string; paraName: string; notionName: string }>
): string {
  const typeList = types.length ? types.join(', ') : 'QCM, QRO, FILL_BLANKS';
  const notionLines = notions.length
    ? notions
        .map((n) => `- ${n.partTitle} › ${n.chapterTitle} › ${n.paraName} › ${n.notionName}`)
        .join('\n')
    : '- Utilise la notion du contexte actuel si disponible';

  return (
    `Génération d'exercices OBLIGATOIRE pour : "${userPrompt}".\n`
    + `Types demandés : ${typeList}.\n`
    + `Appelle create_exercise UNE FOIS par exercice (2 à 6 exercices).\n`
    + `Chaque exercice DOIT avoir notionPath avec les titres EXACTS ci-dessous :\n`
    + `${notionLines}\n`
    + `Rappels types :\n`
    + `- QCU : options[], un seul isCorrect:true\n`
    + `- QCM : options[], plusieurs isCorrect:true possibles\n`
    + `- QRO : question + expectedAnswer\n`
    + `- FILL_BLANKS : parameters.text avec ___ et parameters.blanks[{id,answer}]\n`
    + `Pas de create_structure dans ce passage.`
  );
}

export async function POST(req: Request) {
  const startedAt = Date.now();

  try {
    const { messages, context } = await req.json();

    if (!process.env.MISTRAL_API_KEY) {
      return Response.json({ error: 'MISTRAL_API_KEY manquante' }, { status: 400 });
    }

    const coreMessages = (messages || []).map((msg: { role: string; content: string }) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content || '',
    }));

    const lastUser = coreMessages.filter((m) => m.role === 'user').pop()?.content || '';
    const intent = detectAgentIntent(lastUser);

    let actions: Array<{ type: string; data: unknown; status: string }> = [];
    let resultText = '';

    // ── Passage 1 : cours (si demandé) ──────────────────────────────────────
    if (intent.wantsCourse) {
      let result = await runAgentGeneration(coreMessages, context || {}, {
        toolChoice: { type: 'tool', toolName: 'create_structure' },
        maxSteps: 2,
        timeoutMs: remainingBudgetMs(startedAt),
      });
      actions = extractActionsFromResult(result);
      resultText = result.text || '';

      const needsRetry = !hasValidStructureActions(actions)
        || !hasRichStructureContent(actions);

      if (needsRetry && remainingBudgetMs(startedAt) >= RETRY_MIN_REMAINING_MS) {
        console.warn('[Agent] Structure incomplète — retry avec contenus obligatoires');
        result = await runAgentGeneration(
          [
            ...coreMessages,
            ...(result.text ? [{ role: 'assistant' as const, content: result.text }] : []),
            {
              role: 'user' as const,
              content: `create_structure OBLIGATOIRE pour : "${lastUser}". `
                + 'Chaque partie, chapitre ET paragraphe DOIT avoir un champ intro (HTML, 2-3 phrases). '
                + 'Chaque notion DOIT avoir un champ content (HTML, minimum 80 mots). '
                + 'Ne laisse AUCUN champ intro ou content vide.',
            },
          ],
          context || {},
          {
            toolChoice: { type: 'tool', toolName: 'create_structure' },
            maxSteps: 2,
            timeoutMs: remainingBudgetMs(startedAt),
          }
        );
        actions = extractActionsFromResult(result);
        resultText = result.text || resultText;
      }
    }

    // ── Passage 2 : exercices (seuls ou après le cours) ─────────────────────
    const needExercisePass = intent.wantsExercises
      && (!intent.wantsCourse || !hasExerciseActions(actions))
      && remainingBudgetMs(startedAt) >= EXERCISE_PASS_MIN_MS;

    if (needExercisePass) {
      console.log('[Agent] Passage génération d\'exercices', {
        types: intent.exerciseTypes,
        withCourse: intent.wantsCourse,
      });

      let notions = listNotionsFromStructureActions(actions);

      // Exercices seuls : rattacher à la notion du contexte éditeur si dispo
      if (!notions.length && context?.notionName) {
        notions = [{
          partTitle: String(context.partTitle || 'Partie'),
          chapterTitle: String(context.chapterTitle || 'Chapitre'),
          paraName: String(context.paraName || 'Paragraphe'),
          notionName: String(context.notionName),
        }];
      }

      const exerciseMessages: Array<{ role: 'user' | 'assistant'; content: string }> = intent.wantsCourse
        ? [
            ...coreMessages,
            ...(resultText ? [{ role: 'assistant' as const, content: resultText }] : []),
            {
              role: 'user',
              content: buildExercisePassPrompt(lastUser, intent.exerciseTypes, notions),
            },
          ]
        : [
            ...coreMessages,
            {
              role: 'user',
              content: buildExercisePassPrompt(lastUser, intent.exerciseTypes, notions),
            },
          ];

      try {
        const exerciseResult = await runAgentGeneration(
          exerciseMessages,
          context || {},
          {
            toolChoice: { type: 'tool', toolName: 'create_exercise' },
            maxSteps: 6,
            timeoutMs: remainingBudgetMs(startedAt),
          }
        );
        const exerciseActions = extractActionsFromResult(exerciseResult);
        actions = [...actions, ...exerciseActions];
        if (exerciseResult.text) {
          resultText = resultText
            ? `${resultText}\n\n${exerciseResult.text}`
            : exerciseResult.text;
        }
      } catch (exerciseErr) {
        console.error('[Agent] Passage exercices échoué :', exerciseErr);
        // On conserve le cours déjà généré
      }
    }

    const planMatch = resultText.match(/^([\s\S]*?)(?=\n\n|$)/);
    const plan = planMatch?.[1]?.trim() || resultText.slice(0, 500);

    const defaultText = intent.wantsExercises && !intent.wantsCourse
      ? "Génération d'exercices en cours d'exécution…"
      : intent.wantsExercises
        ? "Structure et exercices en cours d'exécution…"
        : "Structure en cours d'exécution…";

    return Response.json({
      text: resultText || (actions.length ? defaultText : plan),
      plan,
      actions,
      agentMode: true,
      intent: {
        wantsCourse: intent.wantsCourse,
        wantsExercises: intent.wantsExercises,
        exerciseTypes: intent.exerciseTypes,
      },
    });
  } catch (error: unknown) {
    console.error('Agent AI Error:', error);
    const isTimeout = error instanceof Error
      && (error.name === 'TimeoutError' || error.name === 'AbortError' || /timed out|timeout|aborted/i.test(error.message));
    const message = isTimeout
      ? 'La génération a dépassé le délai serveur. Réessayez avec une demande plus courte (ex. « 1 partie sur … »).'
      : (error instanceof Error ? error.message : 'Erreur Agent IA');
    return Response.json({ error: message }, { status: isTimeout ? 504 : 500 });
  }
}
