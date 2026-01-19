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
