import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    notFoundResponse,
    serverErrorResponse,
} from "@/utils/api-response";

type RouteParams = {
    params: Promise<{
        classId: string;
        projectId: string;
    }>;
};

/**
 * POST: Synchronise la version actuelle du projet pour cette classe spécifique.
 * Crée un snapshot (Document) et met à jour le lien doc_id.
 */
export async function POST(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Utilisateur non authentifié", undefined, 401);

        const { classId, projectId } = await context.params;

        // 1. Vérifier que l'utilisateur est le professeur de la classe
        const classroom = await prisma.classroom.findUnique({ where: { id: classId } });
        if (!classroom) return notFoundResponse("Classe non trouvée");
        if (classroom.teacher_id !== userId) {
            return errorResponse("Seul le professeur peut synchroniser le contenu", undefined, 403);
        }

        // 2. Vérifier que le lien existe
        const link = await prisma.classroomProject.findUnique({
            where: {
                classroom_id_project_id: {
                    classroom_id: classId,
                    project_id: projectId
                }
            },
            include: {
                project: true
            }
        });

        if (!link) return notFoundResponse("Le projet n'est pas associé à cette classe");

        // 3. RECUPERER LA STRUCTURE ACTUELLE (Similaire à l'export)
        const parts = await prisma.part.findMany({
            where: { parent_pr: projectId },
            orderBy: { part_number: 'asc' },
            include: {
                chapters: {
                    orderBy: { chapter_number: 'asc' },
                    include: {
                        paragraphs: {
                            orderBy: { para_number: 'asc' },
                            include: {
                                notions: { orderBy: { notion_number: 'asc' } }
                            }
                        }
                    }
                }
            }
        });

        const structureJson = JSON.stringify(parts);

        // 4. CRÉER OU RÉUTILISER UN DOCUMENT (SNAPSHOT)
        const docName = `${link.project.pr_name} (Snapshot Class ${classroom.name})`;

        const document = await prisma.document.upsert({
            where: {
                doc_name_pr_source: {
                    doc_name: docName,
                    pr_source: projectId
                }
            },
            update: {
                doc_size: structureJson.length,
                url_content: structureJson,
                published_at: new Date(),
            },
            create: {
                doc_name: docName,
                pages: 0,
                doc_size: structureJson.length,
                url_content: structureJson,
                pr_source: projectId,
            }
        });

        // 5. METTRE À JOUR LE LIEN CLASSROOM-PROJECT (si nécessaire)
        if (link.doc_id !== document.doc_id) {
            await prisma.classroomProject.update({
                where: { id: link.id },
                data: { doc_id: document.doc_id }
            });
        }

        return successResponse("Contenu synchronisé avec succès pour la classe", { 
            doc_id: document.doc_id,
            updated_at: document.published_at
        });

    } catch (error) {
        console.error("Erreur sync classroom project:", error);
        return serverErrorResponse("Erreur lors de la synchronisation", error instanceof Error ? error.message : undefined);
    }
}
