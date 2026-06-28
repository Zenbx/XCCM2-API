/**
 * Agent IA — construction autonome de cours (mode Cursor-like)
 */
import { generateText } from 'ai';
import { mistral } from '@ai-sdk/mistral';
import {
  AGENT_PERFORMANCE_SUFFIX,
  AGENT_SYSTEM_PROMPT,
  buildContextBlock,
  extractActionsFromResult,
  getEditorTools,
  hasValidStructureActions,
  stepCountIs,
} from '@/lib/ai/editor-tools';

/** Vercel Pro: jusqu'à 300 s. Réserver une marge avant le hard kill. */
export const maxDuration = 300;
const VERCEL_BUDGET_MS = (maxDuration - 20) * 1000;
const RETRY_MIN_REMAINING_MS = 45_000;

async function runAgentGeneration(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  context: Record<string, unknown>,
  options: { forceStructure?: boolean; timeoutMs?: number } = {}
) {
  const timeoutMs = options.timeoutMs ?? VERCEL_BUDGET_MS;

  return generateText({
    model: mistral('mistral-medium-latest'),
    system: AGENT_SYSTEM_PROMPT + AGENT_PERFORMANCE_SUFFIX + buildContextBlock(context),
    messages,
    tools: getEditorTools(),
    toolChoice: options.forceStructure
      ? { type: 'tool', toolName: 'create_structure' }
      : 'auto',
    stopWhen: stepCountIs(2),
    maxOutputTokens: 6144,
    abortSignal: AbortSignal.timeout(timeoutMs),
  });
}

function remainingBudgetMs(startedAt: number): number {
  return Math.max(0, VERCEL_BUDGET_MS - (Date.now() - startedAt));
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

    // Agent mode: forcer create_structure dès le 1er appel (évite un plan texte long sans outil)
    let result = await runAgentGeneration(coreMessages, context || {}, {
      forceStructure: true,
      timeoutMs: remainingBudgetMs(startedAt),
    });
    let actions = extractActionsFromResult(result);

    // Retry uniquement s'il reste assez de budget Vercel
    if (!hasValidStructureActions(actions) && remainingBudgetMs(startedAt) >= RETRY_MIN_REMAINING_MS) {
      console.warn('[Agent] Structure vide — retry avec toolChoice forcé create_structure');
      const lastUser = coreMessages.filter(m => m.role === 'user').pop()?.content || '';

      result = await runAgentGeneration(
        [
          ...coreMessages,
          ...(result.text ? [{ role: 'assistant' as const, content: result.text }] : []),
          {
            role: 'user' as const,
            content: `Exécute create_structure MAINTENANT pour : "${lastUser}". `
              + 'Génère 1 à 2 parties compactes avec chapitres, paragraphes et notions (HTML concis). '
              + 'Appelle l\'outil create_structure, ne réponds pas uniquement en texte.',
          },
        ],
        context || {},
        { forceStructure: true, timeoutMs: remainingBudgetMs(startedAt) }
      );
      actions = extractActionsFromResult(result);
    }

    const text = result.text || '';
    const planMatch = text.match(/^([\s\S]*?)(?=\n\n|$)/);
    const plan = planMatch?.[1]?.trim() || text.slice(0, 500);

    return Response.json({
      text: text || (actions.length ? "Structure en cours d'exécution…" : plan),
      plan,
      actions,
      agentMode: true,
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
