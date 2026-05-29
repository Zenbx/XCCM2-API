import { streamText } from 'ai';
import { mistral } from '@ai-sdk/mistral';
import { SOCRATIC_SYSTEM_PROMPT } from '@/lib/ai/prompts';

export const maxDuration = 60;

/**
 * @openapi
 * /api/ai/socratic:
 *   post:
 *     tags:
 *       - AI
 *     summary: Chat avec l'assistant Socratique
 *     description: Envoie un message à l'IA pour obtenir de l'aide pédagogique. Retourne un flux de texte brut (text/plain).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [messages]
 *             properties:
 *               messages: { type: array, items: { type: object } }
 *               context: { type: object, description: "Contexte de la notion ou du paragraphe actuel" }
 *     responses:
 *       200:
 *         description: Flux de texte brut (text/plain; charset=utf-8)
 */

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [
      'http://localhost:3001',
      'http://localhost:3000',
      'https://xccm-2-api.vercel.app',
      'https://xccm-2.vercel.app',
    ];

export async function POST(req: Request) {
  try {
    const { messages, context } = await req.json();
    const role = req.headers.get('x-user-role') || 'user';
    const requestOrigin = req.headers.get('origin') || '';
    const allowedOrigin = ALLOWED_ORIGINS.includes(requestOrigin)
      ? requestOrigin
      : ALLOWED_ORIGINS[0];

    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id, X-Requested-With, Accept',
      'Access-Control-Allow-Credentials': 'true',
    };

    const coreMessages = (messages || []).map((msg: any) => ({
      role: msg.role,
      content: msg.content || (msg.parts ? msg.parts.map((p: any) => p.text).join('\n') : ''),
    }));

    const systemPrompt = `
${SOCRATIC_SYSTEM_PROMPT(role)}

### CONTEXTE PÉDAGOGIQUE ACTUEL :
${context?.notionContent || "Aucun contenu spécifique fourni."}
${context?.paraName ? `Paragraphe : ${context.paraName}` : ""}
${context?.notionName ? `Notion : ${context.notionName}` : ""}
`;

    if (!process.env.MISTRAL_API_KEY) {
      return Response.json(
        { error: "MISTRAL_API_KEY manquante. Assistant en mode démonstration." },
        { status: 400, headers: corsHeaders }
      );
    }

    const result = streamText({
      model: mistral('mistral-medium-latest'),
      system: systemPrompt,
      messages: coreMessages,
      temperature: 0.7,
    });

    // textStream = ReadableStream de texte brut (pas le protocole AI SDK)
    // Les CORS headers sont posés directement sur ce Response — pas de dépendance au middleware
    return new Response(result.textStream as unknown as ReadableStream, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Socratic AI Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
