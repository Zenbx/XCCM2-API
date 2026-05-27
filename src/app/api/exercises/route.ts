import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { createExerciseSchema } from "@/utils/validation";
import {
    successResponse,
    errorResponse,
    validationErrorResponse,
    serverErrorResponse,
} from "@/utils/api-response";
import { ZodError } from "zod";
import { realtimeService } from "@/services/realtime-service";

/**
 * @openapi
 * /api/exercises:
 *   get:
 *     tags:
 *       - Exercises
 *     summary: Récupérer les exercices
 *     description: Filtre les exercices par créateur ou par granule parent (projet, partie, chapitre, etc.).
 *     parameters:
 *       - in: query
 *         name: project_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: mode
 *         schema:
 *           type: string
 *           enum: [student, teacher]
 *         description: "'student' pour masquer les réponses correctes"
 *     responses:
 *       200:
 *         description: Liste des exercices
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     exercises:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Exercise' }
 *   post:
 *     tags:
 *       - Exercises
 *     summary: Créer un exercice
 *     description: Attache un nouvel exercice à un granule spécifique.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, title]
 *             properties:
 *               type: { type: string, enum: [QCU, QCM, QRO, QROA, CODE, FILL_BLANKS] }
 *               title: { type: string }
 *               description: { type: string }
 *               parameters: { type: object }
 *               settings: { type: object }
 *               notion_id: { type: string }
 *               para_id: { type: string }
 *               chapter_id: { type: string }
 *               part_id: { type: string }
 *               project_id: { type: string }
 *     responses:
 *       201:
 *         description: Exercice créé
 *   patch:
 *     tags:
 *       - Exercises
 *     summary: Réordonner les exercices
 *     description: Met à jour l'ordre de tri des exercices pour un granule.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [exerciseIds]
 *             properties:
 *               exerciseIds: { type: array, items: { type: string } }
 *     responses:
 *       200:
 *         description: Ordre mis à jour
 */
export async function GET(request: NextRequest) {
    try {
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Utilisateur non authentifié", undefined, 401);
        }

        const { searchParams } = new URL(request.url);
        
        const projectId = searchParams.get('project_id');
        const partId = searchParams.get('part_id');
        const chapterId = searchParams.get('chapter_id');
        const paraId = searchParams.get('para_id');
        const notionId = searchParams.get('notion_id');
        const mode = searchParams.get('mode'); // "student" pour masquer les réponses

        // Construction du filtre
        const filter: any = {};

        const hasGranuleFilter = !!(projectId || partId || chapterId || paraId || notionId);

        // En mode enseignant sans filtre de granule → "mes exercices" global → filtrer par créateur
        // En mode enseignant AVEC filtre de granule → tous les exercices du projet (collaborateurs inclus)
        // En mode étudiant → jamais de filtre créateur
        if (mode !== 'student' && !hasGranuleFilter) {
            filter.creator_id = userId;
        }

        if (projectId) filter.project_id = projectId;
        if (partId) filter.part_id = partId;
        if (chapterId) filter.chapter_id = chapterId;
        if (paraId) filter.para_id = paraId;
        if (notionId) filter.notion_id = notionId;

        // En mode étudiant: récupérer aussi les IDs des granules parents pour associer
        // les exercices à tous les niveaux du projet
        if (mode === 'student' && projectId && !partId && !chapterId && !paraId && !notionId) {
            // Récupérer tous les exercices liés à N'IMPORTE QUEL granule de ce projet
            const project = await prisma.project.findUnique({
                where: { pr_id: projectId },
                include: {
                    parts: {
                        include: {
                            chapters: {
                                include: {
                                    paragraphs: {
                                        include: {
                                            notions: true
                                        }
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

                delete filter.project_id;
                filter.OR = [
                    { project_id: projectId },
                    { part_id: { in: partIds } },
                    { chapter_id: { in: chapterIds } },
                    { para_id: { in: paraIds } },
                    { notion_id: { in: notionIds } },
                ];
            } else {
                // Si le projet n'est pas trouvé par son ID, on reste sur le filtre simple project_id
                // mais on s'assure qu'on cherche au moins les exercices liés au projet lui-même
                filter.project_id = projectId;
            }
        }

        const exercises = await prisma.exercise.findMany({
            where: filter,
            orderBy: [
                { order: "asc" },
                { created_at: "asc" }
            ],
            include: {
                _count: {
                    select: { submissions: true }
                }
            }
        });

        // En mode étudiant, masquer les réponses dans les paramètres
        const sanitizedExercises = mode === 'student'
            ? exercises.map((ex: any) => {
                const params = typeof ex.parameters === 'object' ? { ...ex.parameters as any } : {};
                
                // Masquer les bonnes réponses QCU/QCM
                if (params.options) {
                    params.options = params.options.map((opt: any) => ({
                        id: opt.id,
                        text: opt.text,
                        // isCorrect est retiré !
                    }));
                }
                // Masquer la réponse attendue QRO
                delete params.expectedAnswer;
                // Masquer le prompt d'évaluation QROA
                delete params.evaluationPrompt;
                // Masquer les cas de test CODE
                delete params.testCases;
                // Masquer les réponses FILL_BLANKS
                if (params.blanks) {
                    params.blanks = params.blanks.map((b: any) => ({
                        id: b.id,
                        // answer est retiré !
                    }));
                }

                return { ...ex, parameters: params };
            })
            : exercises;

        return successResponse("Exercices récupérés avec succès", { exercises: sanitizedExercises });

    } catch (error) {
        console.error("Erreur lors de la récupération des exercices:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la récupération des exercices",
            error instanceof Error ? error.message : undefined
        );
    }
}

/**
 * POST: Créer un nouvel exercice attaché à un granule
 */
export async function POST(request: NextRequest) {
    try {
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return errorResponse("Utilisateur non authentifié", undefined, 401);
        }

        const body = await request.json();
        const validatedData = createExerciseSchema.parse(body);

        // 1. Trouver l'ordre maximum pour ce granule afin d'ajouter à la fin (FIFO)
        const filter: any = {};
        if (validatedData.project_id) filter.project_id = validatedData.project_id;
        if (validatedData.part_id) filter.part_id = validatedData.part_id;
        if (validatedData.chapter_id) filter.chapter_id = validatedData.chapter_id;
        if (validatedData.para_id) filter.para_id = validatedData.para_id;
        if (validatedData.notion_id) filter.notion_id = validatedData.notion_id;

        const lastExercise = await prisma.exercise.findFirst({
            where: filter,
            orderBy: { order: 'desc' },
            select: { order: true }
        });

        const nextOrder = (lastExercise?.order ?? -1) + 1;

        // 2. Créer l'exercice (lié au prof et aux granules passés)
        const exercise = await prisma.exercise.create({
            data: {
                type: validatedData.type,
                title: validatedData.title,
                description: validatedData.description || null,
                parameters: validatedData.parameters || {},
                settings: validatedData.settings || null,
                project_id: validatedData.project_id || null,
                part_id: validatedData.part_id || null,
                chapter_id: validatedData.chapter_id || null,
                para_id: validatedData.para_id || null,
                notion_id: validatedData.notion_id || null,
                creator_id: userId,
                order: nextOrder
            }
        });

        // Broadcast real-time event so collaborators refresh their ExercisePanel
        const projectIdForBroadcast = validatedData.project_id;
        if (projectIdForBroadcast) {
            const project = await prisma.project.findUnique({
                where: { pr_id: projectIdForBroadcast },
                select: { pr_name: true },
            });
            if (project) {
                realtimeService.broadcastStructureChange(project.pr_name, 'EXERCISE_CHANGED', {
                    action: 'created',
                    exerciseId: exercise.id,
                    notionId: validatedData.notion_id || null,
                }).catch(() => {}); // fire-and-forget, don't block the response
            }
        }

        return successResponse("Exercice créé avec succès", { exercise }, 201);

    } catch (error) {
        if (error instanceof ZodError) {
            const errors: Record<string, string[]> = {};
            error.issues.forEach((err) => {
                const field = err.path.join(".");
                if (!errors[field]) {
                    errors[field] = [];
                }
                errors[field].push(err.message);
            });
            return validationErrorResponse(errors);
        }

        console.error("Erreur lors de la création de l'exercice:", error);
        return serverErrorResponse(
            "Une erreur est survenue lors de la création de l'exercice",
            error instanceof Error ? error.message : undefined
        );
    }
}
/**
 * PATCH: Mise à jour en masse de l'ordre des exercices
 */
export async function PATCH(request: NextRequest) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Utilisateur non authentifié", undefined, 401);

        const { exerciseIds } = await request.json();

        if (!Array.isArray(exerciseIds)) {
            return errorResponse("exerciseIds doit être un tableau", undefined, 400);
        }

        // Mise à jour séquentielle de l'ordre
        const updates = exerciseIds.map((id, index) => 
            prisma.exercise.update({
                where: { id, creator_id: userId },
                data: { order: index }
            })
        );

        await Promise.all(updates);

        return successResponse("Ordre mis à jour");

    } catch (error) {
        console.error("Erreur réordonnancement:", error);
        return serverErrorResponse("Erreur serveur", error instanceof Error ? error.message : undefined);
    }
}
