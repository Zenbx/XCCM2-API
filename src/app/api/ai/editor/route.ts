/**
 * @openapi
 * /api/ai/editor:
 *   post:
 *     tags:
 *       - AI
 *     summary: Assistant IA éditeur (Mistral)
 *     description: Génère des actions structurées (create_structure, write_content, create_exercise) via Mistral avec tool calling.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - messages
 *             properties:
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, assistant]
 *                     content:
 *                       type: string
 *               context:
 *                 type: object
 *                 properties:
 *                   projectName:
 *                     type: string
 *                   partTitle:
 *                     type: string
 *                   chapterTitle:
 *                     type: string
 *                   paraName:
 *                     type: string
 *                   notionName:
 *                     type: string
 *                   notionContent:
 *                     type: string
 *     responses:
 *       200:
 *         description: Réponse de l'IA avec texte et actions à exécuter
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 text:
 *                   type: string
 *                 actions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                         enum: [create_structure, write_content, create_exercise]
 *                       data:
 *                         type: object
 *                       status:
 *                         type: string
 *       400:
 *         description: MISTRAL_API_KEY manquante
 *       500:
 *         description: Erreur interne
 */
import { generateText, tool } from 'ai';
import { mistral } from '@ai-sdk/mistral';
import { z } from 'zod';

export const maxDuration = 60;

const EDITOR_SYSTEM_PROMPT = `Tu es l'Assistant IA Éditeur d'XCCM2, une plateforme de composition de cours universitaires.

### TA MISSION
Tu aides les auteurs (professeurs) à construire leurs cours en exécutant des ACTIONS concrètes. Tu n'es PAS un simple assistant conversationnel : tu ES un outil de production.

### TES CAPACITÉS (outils disponibles)
1. **create_structure** : Créer une arborescence complète (Parties → Chapitres → Paragraphes → Notions) avec du contenu pédagogique
2. **write_content** : Écrire ou réécrire le contenu d'une notion ou du paragraphe actuel
3. **create_exercise** : Générer des exercices (QCU, QCM, QRO, texte à trous, code)

### RÈGLES
- Quand on te demande de CRÉER ou STRUCTURER, utilise TOUJOURS l'outil create_structure
- Quand on te demande d'ÉCRIRE ou RÉDIGER du contenu, utilise write_content
- Quand on te demande un QUIZ, QCM, EXERCICE, utilise create_exercise
- Pour les QCU/QCM, chaque option doit avoir un id unique (opt_1, opt_2, etc.)
- Génère du contenu RICHE et PÉDAGOGIQUE, pas des squelettes
- Accompagne TOUJOURS ton action d'un message expliquant ce que tu fais
- Le contenu doit être en français sauf indication contraire
- IMPORTANT : Appelle TOUJOURS un outil quand l'utilisateur fait une demande d'action. Ne te contente pas de décrire ce que tu ferais.
`;

export async function POST(req: Request) {
  try {
    const { messages, context } = await req.json();

    if (!process.env.MISTRAL_API_KEY) {
      return Response.json({
        error: "MISTRAL_API_KEY manquante"
      }, { status: 400 });
    }

    const contextStr = `
### CONTEXTE ACTUEL
Projet : ${context?.projectName || 'Non spécifié'}
Partie : ${context?.partTitle || 'Non spécifiée'}
Chapitre : ${context?.chapterTitle || 'Non spécifié'}
Paragraphe : ${context?.paraName || 'Non spécifié'}
Notion : ${context?.notionName || 'Non spécifiée'}
Contenu actuel de l'éditeur :
${context?.notionContent ? context.notionContent.substring(0, 2000) : 'Vide'}
`;

    const coreMessages = (messages || []).map((msg: any) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content || '',
    }));

    const result = await generateText({
      model: mistral('mistral-medium-latest'),
      system: EDITOR_SYSTEM_PROMPT + contextStr,
      messages: coreMessages,
      tools: {
        create_structure: tool({
          description: "Crée une structure de cours complète avec des parties, chapitres, paragraphes et notions.",
          parameters: z.object({
            parts: z.array(z.object({
              title: z.string().describe("Titre de la partie"),
              intro: z.string().optional().describe("Introduction de la partie"),
              chapters: z.array(z.object({
                title: z.string().describe("Titre du chapitre"),
                intro: z.string().optional().describe("Introduction du chapitre"),
                paragraphs: z.array(z.object({
                  title: z.string().describe("Titre du paragraphe"),
                  intro: z.string().optional(),
                  notions: z.array(z.object({
                    title: z.string().describe("Titre de la notion"),
                    content: z.string().describe("Contenu pédagogique")
                  })).optional()
                })).optional()
              })).optional()
            }))
          }),
        }),
        write_content: tool({
          description: "Écrit ou réécrit le contenu pédagogique.",
          parameters: z.object({
            content: z.string().describe("Le contenu pédagogique à écrire"),
            target: z.enum(["current", "notion"]).describe("'current' pour l'éditeur actif, 'notion' pour une notion spécifique"),
            notionPath: z.object({
              partTitle: z.string(),
              chapterTitle: z.string(),
              paraName: z.string(),
              notionName: z.string(),
            }).optional()
          }),
        }),
        create_exercise: tool({
          description: "Crée un exercice pédagogique.",
          parameters: z.object({
            type: z.enum(["QCU", "QCM", "QRO", "QROA", "CODE", "FILL_BLANKS"]),
            title: z.string(),
            parameters: z.object({
              question: z.string().optional(),
              options: z.array(z.object({
                id: z.string(),
                text: z.string(),
                isCorrect: z.boolean()
              })).optional(),
              expectedAnswer: z.string().optional(),
              evaluationPrompt: z.string().optional(),
              text: z.string().optional().describe("Texte à trous avec {{mot}}")
            }),
            settings: z.object({
              isBlocking: z.boolean().optional(),
              maxAttempts: z.number().optional(),
              points: z.number().optional()
            }).optional()
          }),
        }),
      },
      maxSteps: 3,
    });

    // Collect all tool calls from all steps
    const actions: any[] = [];

    if (result.steps) {
      for (const step of result.steps) {
        if (step.toolCalls) {
          for (const tc of step.toolCalls) {
            actions.push({
              type: tc.toolName,
              data: tc.args,
              status: 'pending',
            });
          }
        }
      }
    }

    // Also check top-level toolCalls
    if (result.toolCalls && result.toolCalls.length > 0) {
      for (const tc of result.toolCalls) {
        // Avoid duplicates
        const exists = actions.some(a => a.type === tc.toolName && JSON.stringify(a.data) === JSON.stringify(tc.args));
        if (!exists) {
          actions.push({
            type: tc.toolName,
            data: tc.args,
            status: 'pending',
          });
        }
      }
    }

    const text = result.text || (actions.length > 0
      ? "J'ai préparé les actions suivantes. Cliquez sur les boutons pour les exécuter :"
      : "");

    return Response.json({ text, actions });

  } catch (error: any) {
    console.error('Editor AI Error:', error);
    return Response.json(
      { error: error.message || "Erreur IA Éditeur" },
      { status: 500 }
    );
  }
}
