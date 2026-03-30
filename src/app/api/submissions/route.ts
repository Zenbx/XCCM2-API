import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { 
    successResponse, 
    errorResponse, 
    serverErrorResponse 
} from "@/utils/api-response";
import { HfInference } from "@huggingface/inference";

/**
 * GET: Récupère les soumissions de l'étudiant connecté
 * Query params: exercise_id, project_id
 */
export async function GET(request: NextRequest) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Utilisateur non authentifié", undefined, 401);

        const { searchParams } = new URL(request.url);
        const exerciseId = searchParams.get('exercise_id');
        const projectId = searchParams.get('project_id');

        const filter: any = { student_id: userId };

        if (exerciseId) {
            filter.exercise_id = exerciseId;
        }

        // Si project_id est fourni, récupérer les soumissions pour tous les exercices de ce projet
        if (projectId) {
            const project = await prisma.project.findUnique({
                where: { pr_id: projectId },
                include: {
                    parts: {
                        include: {
                            chapters: {
                                include: {
                                    paragraphs: {
                                        include: { notions: true }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            if (project) {
                const partIds = project.parts.map((p: any) => p.part_id);
                const chapterIds = project.parts.flatMap((p: any) => p.chapters.map((c: any) => c.chapter_id));
                const paraIds = project.parts.flatMap((p: any) => p.chapters.flatMap((c: any) => c.paragraphs.map((pa: any) => pa.para_id)));
                const notionIds = project.parts.flatMap((p: any) => p.chapters.flatMap((c: any) => c.paragraphs.flatMap((pa: any) => pa.notions.map((n: any) => n.notion_id))));

                // Trouver tous les exerciseIds liés à ce projet
                const exercisesInProject = await prisma.exercise.findMany({
                    where: {
                        OR: [
                            { project_id: projectId },
                            { part_id: { in: partIds } },
                            { chapter_id: { in: chapterIds } },
                            { para_id: { in: paraIds } },
                            { notion_id: { in: notionIds } },
                        ]
                    },
                    select: { id: true }
                });

                filter.exercise_id = { in: exercisesInProject.map(e => e.id) };
            }
        }

        const submissions = await prisma.submission.findMany({
            where: filter,
            orderBy: { submitted_at: "desc" },
            include: {
                exercise: {
                    select: { id: true, type: true, title: true }
                }
            }
        });

        return successResponse("Soumissions récupérées", { submissions });

    } catch (error) {
        console.error("Erreur récupération soumissions:", error);
        return serverErrorResponse("Erreur serveur", error instanceof Error ? error.message : undefined);
    }
}

/**
 * POST: Soumettre une réponse à un exercice
 * Body: { exercise_id, answers }
 * Auto-correction pour QCU, QCM, QRO, FILL_BLANKS
 */
export async function POST(request: NextRequest) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Utilisateur non authentifié", undefined, 401);

        const body = await request.json();
        const { exercise_id, answers } = body;

        if (!exercise_id || answers === undefined) {
            return errorResponse("exercise_id et answers sont requis", undefined, 400);
        }

        // Récupérer l'exercice avec les réponses
        const exercise = await prisma.exercise.findUnique({
            where: { id: exercise_id }
        });

        if (!exercise) return errorResponse("Exercice non trouvé", undefined, 404);

        // Vérifier les tentatives max
        const settings = exercise.settings as any;
        if (settings?.maxAttempts) {
            const existingCount = await prisma.submission.count({
                where: { student_id: userId, exercise_id }
            });
            if (existingCount >= settings.maxAttempts) {
                return errorResponse(`Nombre maximum de tentatives atteint (${settings.maxAttempts})`, undefined, 403);
            }
        }

        // ═══════ AUTO-CORRECTION ═══════
        let score: number | null = null;
        let feedback: string | null = null;
        const params = exercise.parameters as any;
        const maxPoints = settings?.points || 10;

        switch (exercise.type) {
            case 'QCU': {
                const selectedId = answers.selectedOptionId;
                const correctOption = params.options?.find((o: any) => o.isCorrect);
                const isCorrect = selectedId === correctOption?.id;
                score = isCorrect ? maxPoints : 0;
                feedback = isCorrect
                    ? "✅ Bonne réponse !"
                    : `❌ Incorrect. La bonne réponse était : "${correctOption?.text}"`;
                break;
            }

            case 'QCM': {
                const selectedIds: string[] = answers.selectedOptionIds || [];
                const correctIds = (params.options || []).filter((o: any) => o.isCorrect).map((o: any) => o.id);
                const correctSelected = selectedIds.filter((id: string) => correctIds.includes(id)).length;
                const wrongSelected = selectedIds.filter((id: string) => !correctIds.includes(id)).length;
                const totalCorrect = correctIds.length;
                // Score partiel : chaque bonne réponse vaut des points, chaque mauvaise en retire
                const rawScore = Math.max(0, (correctSelected - wrongSelected) / totalCorrect);
                score = Math.round(rawScore * maxPoints * 100) / 100;
                feedback = score === maxPoints
                    ? "✅ Toutes les bonnes réponses !"
                    : `${correctSelected}/${totalCorrect} bonnes réponses sélectionnées.`;
                break;
            }

            case 'QRO': {
                const studentAnswer = (answers.text || '').trim();
                const expected = (params.expectedAnswer || '').trim();
                const caseSensitive = params.caseSensitive || false;
                const isCorrect = caseSensitive
                    ? studentAnswer === expected
                    : studentAnswer.toLowerCase() === expected.toLowerCase();
                score = isCorrect ? maxPoints : 0;
                feedback = isCorrect
                    ? "✅ Bonne réponse !"
                    : `❌ Incorrect. La réponse attendue était : "${expected}"`;
                break;
            }

            case 'FILL_BLANKS': {
                const blanks = params.blanks || [];
                const studentBlanks = answers.blanks || {};
                let correctCount = 0;
                blanks.forEach((blank: any) => {
                    const studentVal = (studentBlanks[blank.id] || '').trim().toLowerCase();
                    const expected = (blank.answer || '').trim().toLowerCase();
                    const alternatives = (blank.alternatives || []).map((a: string) => a.trim().toLowerCase());
                    if (studentVal === expected || alternatives.includes(studentVal)) {
                        correctCount++;
                    }
                });
                score = blanks.length > 0 ? Math.round((correctCount / blanks.length) * maxPoints * 100) / 100 : 0;
                feedback = `${correctCount}/${blanks.length} trous correctement remplis.`;
                break;
            }

            case 'QROA': {
                const studentAnswer = (answers.text || '').trim();
                const expectedContext = (params.expectedAnswer || '').trim();
                const questionText = exercise.title;

                if (!studentAnswer) {
                    score = 0;
                    feedback = "❌ Aucune réponse fournie.";
                    break;
                }

                const apiKey = process.env.HUGGINGFACE_API_KEY || process.env.HUGGING_FACE_API_KEY || process.env.HF_API_TOKEN;
                
                if (!apiKey) {
                    score = null;
                    feedback = "📝 Mode Démo : Votre réponse a été soumise. L'IA n'est pas configurée pour la correction automatique.";
                    break;
                }

                try {
                    const hf = new HfInference(apiKey);
                    const prompt = `<s>[INST] Tu es un correcteur automatique expert.
Évalue la réponse de l'étudiant par rapport à la réponse attendue pour la question donnée.
Donne un score sur ${maxPoints} et un feedback constructif en français.

QUESTION : ${questionText}
RÉPONSE ATTENDUE (CONCEPTS CLÉS) : ${expectedContext}
RÉPONSE ÉTUDIANT : ${studentAnswer}

FORMAT JSON STRICT :
{
  "score": number,
  "feedback": "string"
} [/INST]`;

                    const response = await hf.textGeneration({
                        model: "mistralai/Mistral-7B-Instruct-v0.2",
                        inputs: prompt,
                        parameters: { max_new_tokens: 500, temperature: 0.1, return_full_text: false }
                    });

                    const raw = response.generated_text || "{}";
                    const jsonMatch = raw.match(/\{[\s\S]*\}/);
                    const result = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
                    
                    score = Math.min(maxPoints, Math.max(0, result.score || 0));
                    feedback = `🤖 (IA) ${result.feedback || "Évaluation terminée."}`;
                } catch (e) {
                    console.error("Erreur correction IA QROA:", e);
                    score = null;
                    feedback = "📝 Erreur technique lors de la correction IA. Votre réponse sera validée par le professeur.";
                }
                break;
            }

            case 'CODE': {
                // Pas d'exécution de code côté serveur pour l'instant
                score = null;
                feedback = "💻 Votre code a été soumis. Il sera évalué par le professeur.";
                break;
            }
        }

        const submission = await prisma.submission.create({
            data: {
                student_id: userId,
                exercise_id,
                answers,
                score,
                feedback,
            }
        });

        return successResponse("Réponse soumise", {
            submission,
            result: {
                score,
                maxPoints,
                feedback,
                isAutoGraded: ['QCU', 'QCM', 'QRO', 'FILL_BLANKS'].includes(exercise.type),
                isPerfect: score === maxPoints,
            }
        }, 201);

    } catch (error) {
        console.error("Erreur soumission:", error);
        return serverErrorResponse("Erreur serveur", error instanceof Error ? error.message : undefined);
    }
}
