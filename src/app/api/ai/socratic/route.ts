// src/app/api/ai/socratic/route.ts
import { streamText } from 'ai';
import { google } from '@ai-sdk/google';
import { SOCRATIC_SYSTEM_PROMPT } from '@/lib/ai/prompts';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages, context } = await req.json();
    const role = req.headers.get('x-user-role') || 'user';

    // ✅ Mappage des messages (SDK v6 compatibility)
    // Le frontend (ai@6) envoie 'parts', le backend (core SDK) attend 'content'
    const coreMessages = (messages || []).map((msg: any) => ({
      role: msg.role,
      content: msg.content || (msg.parts ? msg.parts.map((p: any) => p.text).join('\n') : ''),
    }));

    // Construction du prompt enrichi avec le contexte pédagogique et le rôle
    const systemPrompt = `
${SOCRATIC_SYSTEM_PROMPT(role)}

### CONTEXTE PÉDAGOGIQUE ACTUEL :
${context?.notionContent || "Aucun contenu spécifique fourni."}
${context?.paraName ? `Paragraphe : ${context.paraName}` : ""}
${context?.notionName ? `Notion : ${context.notionName}` : ""}
`;

    const result = streamText({
      model: google('gemini-pro-latest'),
      system: systemPrompt,
      messages: coreMessages,
      temperature: 0.7,
    });

    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error('Socratic AI Stream Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
