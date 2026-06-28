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
} from '@/lib/ai/editor-tools';

export const maxDuration = 120;

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

    const result = await generateText({
      model: mistral('mistral-medium-latest'),
      system: AGENT_SYSTEM_PROMPT + buildContextBlock(context),
      messages: coreMessages,
      tools: getEditorTools(),
      maxSteps: 8,
    });

    const actions = extractActionsFromResult(result);
    const text = result.text || '';
    const planMatch = text.match(/^([\s\S]*?)(?=\n\n|$)/);
    const plan = planMatch?.[1]?.trim() || text.slice(0, 300);

    const defaultText = actions.length > 0
      ? "J'ai préparé le plan et les actions. L'agent va les exécuter automatiquement."
      : text;

    return Response.json({
      text: text || defaultText,
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
