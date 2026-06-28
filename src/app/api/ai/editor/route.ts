/**
 * @openapi
 * /api/ai/editor:
 *   post:
 *     tags:
 *       - AI
 *     summary: Assistant IA éditeur (Mistral)
 */
import { generateText } from 'ai';
import { mistral } from '@ai-sdk/mistral';
import {
  EDITOR_CHAT_PROMPT,
  buildContextBlock,
  extractActionsFromResult,
  getEditorTools,
  stepCountIs,
} from '@/lib/ai/editor-tools';

export const maxDuration = 60;

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
      system: EDITOR_CHAT_PROMPT + buildContextBlock(context),
      messages: coreMessages,
      tools: getEditorTools(),
      stopWhen: stepCountIs(3),
      maxOutputTokens: 4096,
    });

    const actions = extractActionsFromResult(result);
    const text = result.text || (actions.length > 0
      ? "J'ai préparé les actions suivantes. Cliquez sur les boutons pour les exécuter :"
      : '');

    return Response.json({ text, actions });
  } catch (error: unknown) {
    console.error('Editor AI Error:', error);
    const message = error instanceof Error ? error.message : 'Erreur IA Éditeur';
    return Response.json({ error: message }, { status: 500 });
  }
}
