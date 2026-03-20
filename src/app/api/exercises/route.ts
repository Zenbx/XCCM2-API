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

/**
 * GET: Récupère les exercices créés par le professeur, ou filtre par granule
 * Query params supportés: project_id, part_id, chapter_id, para_id, notion_id
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

        // Construction du filtre: Si aucun id de granule n'est fourni, on récupère 
        // tous les exercices créés par cet utilisateur.
        const filter: any = {
            creator_id: userId
        };

        if (projectId) filter.project_id = projectId;
        if (partId) filter.part_id = partId;
        if (chapterId) filter.chapter_id = chapterId;
        if (paraId) filter.para_id = paraId;
        if (notionId) filter.notion_id = notionId;

        const exercises = await prisma.exercise.findMany({
            where: filter,
            orderBy: { created_at: "desc" },
            include: {
                _count: {
                    select: { submissions: true }
                }
            }
        });

        return successResponse("Exercices récupérés avec succès", { exercises });

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

        // Créer l'exercice (lié au prof et aux granules passés)
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
                creator_id: userId
            }
        });

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
