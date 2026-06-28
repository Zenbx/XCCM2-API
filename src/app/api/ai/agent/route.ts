/**
 * Agent IA — construction autonome de cours (mode Cursor-like)
 */
import { generateText } from 'ai';
import { mistral } from '@ai-sdk/mistral';
import {
  AGENT_SYSTEM_PROMPT,
  buildContextBlock,
  extractActionsFromResult,
  getEditorTools,
  hasValidStructureActions,
  stepCountIs,
} from '@/lib/ai/editor-tools';

export const maxDuration = 120;

async function runAgentGeneration(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  context: Record<string, unknown>,
  options: { forceStructure?: boolean } = {}
) {
  return generateText({
    model: mistral('mistral-medium-latest'),
    system: AGENT_SYSTEM_PROMPT + buildContextBlock(context),
    messages,
    tools: getEditorTools(),
    toolChoice: options.forceStructure
      ? { type: 'tool', toolName: 'create_structure' }
      : 'auto',
    stopWhen: stepCountIs(5),
    maxOutputTokens: 8192,
  });
}

export async function POST(req: Request) {
  try {
    const { messages, context } = await req.json();

    if (!process.env.MISTRAL_API_KEY) {
      return Response.json({ error: 'MISTRAL_API_KEY manquante' }, { status: 400 });
    }

    const coreMessages = (messages || []).map((msg: { role: string; content: string }) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content || '',
    }));

    let result = await runAgentGeneration(coreMessages, context || {});
    let actions = extractActionsFromResult(result);

    // Retry forcé si l'IA n'a produit qu'un plan texte sans structure exploitable
    if (!hasValidStructureActions(actions)) {
      console.warn('[Agent] Structure vide — retry avec toolChoice forcé create_structure');
      const lastUser = coreMessages.filter(m => m.role === 'user').pop()?.content || '';

      result = await runAgentGeneration(
        [
          ...coreMessages,
          ...(result.text ? [{ role: 'assistant' as const, content: result.text }] : []),
          {
            role: 'user' as const,
            content: `Exécute create_structure MAINTENANT pour : "${lastUser}". `
              + 'Génère 2 à 3 parties avec chapitres, paragraphes et notions (contenu HTML dans chaque notion). '
              + 'Appelle l\'outil create_structure, ne réponds pas uniquement en texte.',
          },
        ],
        context || {},
        { forceStructure: true }
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
    const message = error instanceof Error ? error.message : 'Erreur Agent IA';
    return Response.json({ error: message }, { status: 500 });
  }
}
