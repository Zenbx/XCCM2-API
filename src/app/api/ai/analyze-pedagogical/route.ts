/**
 * @openapi
 * /api/ai/analyze-pedagogical:
 *   post:
 *     tags:
 *       - AI
 *     summary: Analyse pédagogique socratique
 *     description: Analyse un texte avec SocrateAI (Hugging Face) et retourne feedback pédagogique + score Bloom.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 description: Contenu à analyser
 *               notionId:
 *                 type: string
 *                 description: ID de la notion (optionnel, renvoyé dans la réponse)
 *     responses:
 *       200:
 *         description: Analyse pédagogique réussie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     feedback:
 *                       type: object
 *                     bloomScore:
 *                       type: object
 *                     notionId:
 *                       type: string
 *                       nullable: true
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Texte manquant
 *       500:
 *         description: Erreur IA
 */
import { NextResponse } from 'next/server';
import { SocraticReviewer } from '../../../../ai/socraticReviewer';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { text, notionId } = body;

        if (!text) {
            return NextResponse.json(
                { message: 'Text content is required' },
                { status: 400 }
            );
        }

        const reviewer = new SocraticReviewer();

        // Parallel execution for speed
        const [feedback, bloomScore] = await Promise.all([
            reviewer.analyzeContent(text),
            reviewer.scoreBloomTaxonomy(text)
        ]);

        return NextResponse.json({
            success: true,
            data: {
                feedback,
                bloomScore,
                notionId,
                timestamp: new Date().toISOString()
            }
        });


    } catch (error: any) {
        console.error('Socratic AI Error:', error);
        return NextResponse.json(
            { message: 'Error analyzing content', error: error.message },
            { status: 500 }
        );
    }
}
