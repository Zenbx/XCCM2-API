import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    notFoundResponse,
    serverErrorResponse,
} from "@/utils/api-response";

type RouteParams = {
    params: Promise<{ classId: string }>;
};

/**
 * GET: Analytics complètes d'une classe pour le professeur
 * Retourne: stats globales, progression par étudiant, succès par exercice, insights
 */
export async function GET(request: NextRequest, context: RouteParams) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) return errorResponse("Utilisateur non authentifié", undefined, 401);

        const { classId } = await context.params;

        // 1. Vérifier que la classe existe et que l'utilisateur est le prof
        const classroom = await prisma.classroom.findUnique({
            where: { id: classId },
            include: {
                enrollments: {
                    include: {
                        student: {
                            select: { user_id: true, firstname: true, lastname: true, email: true }
                        }
                    }
                },
                projects: {
                    include: {
                        project: {
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
                        }
                    }
                }
            }
        });

        if (!classroom) return notFoundResponse("Classe non trouvée");
        if (classroom.teacher_id !== userId) {
            return errorResponse("Accès réservé au professeur de cette classe", undefined, 403);
        }

        const studentIds = classroom.enrollments.map(e => e.student.user_id);

        // 2. Collecter tous les IDs de granules pour tous les projets de la classe
        const allGranuleIds: { projectIds: string[]; partIds: string[]; chapterIds: string[]; paraIds: string[]; notionIds: string[] } = {
            projectIds: [], partIds: [], chapterIds: [], paraIds: [], notionIds: []
        };

        classroom.projects.forEach((cp: any) => {
            allGranuleIds.projectIds.push(cp.project.pr_id);
            cp.project.parts?.forEach((p: any) => {
                allGranuleIds.partIds.push(p.part_id);
                p.chapters?.forEach((c: any) => {
                    allGranuleIds.chapterIds.push(c.chapter_id);
                    c.paragraphs?.forEach((pa: any) => {
                        allGranuleIds.paraIds.push(pa.para_id);
                        pa.notions?.forEach((n: any) => {
                            allGranuleIds.notionIds.push(n.notion_id);
                        });
                    });
                });
            });
        });

        // 3. Récupérer tous les exercices liés à ces projets
        const exercises = await prisma.exercise.findMany({
            where: {
                OR: [
                    { project_id: { in: allGranuleIds.projectIds } },
                    { part_id: { in: allGranuleIds.partIds } },
                    { chapter_id: { in: allGranuleIds.chapterIds } },
                    { para_id: { in: allGranuleIds.paraIds } },
                    { notion_id: { in: allGranuleIds.notionIds } },
                ]
            }
        });

        const exerciseIds = exercises.map(e => e.id);

        // 4. Récupérer toutes les soumissions des étudiants de cette classe
        const submissions = await prisma.submission.findMany({
            where: {
                student_id: { in: studentIds },
                exercise_id: { in: exerciseIds }
            },
            orderBy: { submitted_at: "desc" }
        });

        // ═══════ CALCULS ANALYTICS ═══════

        // Stats globales
        const totalStudents = studentIds.length;
        const totalExercises = exercises.length;
        const totalSubmissions = submissions.length;

        // Score moyen global
        const gradedSubmissions = submissions.filter(s => s.score !== null);
        const avgScore = gradedSubmissions.length > 0
            ? Math.round((gradedSubmissions.reduce((sum, s) => sum + (s.score || 0), 0) / gradedSubmissions.length) * 100) / 100
            : 0;

        // Taux de complétion global (étudiants ayant au moins 1 soumission correcte / total possible)
        const totalPossible = totalStudents * totalExercises;
        const correctSubmissions = submissions.filter(s => s.score !== null && s.score > 0);
        const completionRate = totalPossible > 0
            ? Math.round((correctSubmissions.length / totalPossible) * 100)
            : 0;

        // ═══════ PAR ÉTUDIANT ═══════
        const studentAnalytics = classroom.enrollments.map(enrollment => {
            const studentSubs = submissions.filter(s => s.student_id === enrollment.student.user_id);
            const studentGraded = studentSubs.filter(s => s.score !== null);
            const studentCorrect = studentSubs.filter(s => s.score !== null && s.score > 0);

            const exercisesAttempted = new Set(studentSubs.map(s => s.exercise_id)).size;
            const exercisesCompleted = new Set(studentCorrect.map(s => s.exercise_id)).size;

            const studentAvg = studentGraded.length > 0
                ? Math.round((studentGraded.reduce((sum, s) => sum + (s.score || 0), 0) / studentGraded.length) * 100) / 100
                : 0;

            const progress = totalExercises > 0
                ? Math.round((exercisesCompleted / totalExercises) * 100)
                : 0;

            // Dernière activité
            const lastActivity = studentSubs.length > 0
                ? studentSubs[0].submitted_at
                : null;

            return {
                student: enrollment.student,
                enrolled_at: enrollment.enrolled_at,
                exercisesAttempted,
                exercisesCompleted,
                totalExercises,
                avgScore: studentAvg,
                progress,
                totalSubmissions: studentSubs.length,
                lastActivity,
            };
        });

        // ═══════ PAR EXERCICE ═══════
        const exerciseAnalytics = exercises.map(exercise => {
            const exSubs = submissions.filter(s => s.exercise_id === exercise.id);
            const exGraded = exSubs.filter(s => s.score !== null);
            const exCorrect = exSubs.filter(s => s.score !== null && s.score > 0);
            const settings = exercise.settings as any;
            const maxPoints = settings?.points || 10;

            const successRate = exGraded.length > 0
                ? Math.round((exCorrect.length / exGraded.length) * 100)
                : 0;

            const avgExScore = exGraded.length > 0
                ? Math.round((exGraded.reduce((sum, s) => sum + (s.score || 0), 0) / exGraded.length) * 100) / 100
                : 0;

            const studentsAttempted = new Set(exSubs.map(s => s.student_id)).size;
            const avgAttempts = studentsAttempted > 0
                ? Math.round((exSubs.length / studentsAttempted) * 10) / 10
                : 0;

            return {
                id: exercise.id,
                title: exercise.title,
                type: exercise.type,
                successRate,
                avgScore: avgExScore,
                maxPoints,
                studentsAttempted,
                totalStudents,
                avgAttempts,
                totalSubmissions: exSubs.length,
            };
        });

        // ═══════ INSIGHTS / SUGGESTIONS IA ═══════
        const insights: Array<{ type: 'warning' | 'success' | 'info' | 'suggestion'; icon: string; title: string; description: string }> = [];

        // Exercice le plus difficile
        const hardestExercise = exerciseAnalytics
            .filter(e => e.studentsAttempted >= 2)
            .sort((a, b) => a.successRate - b.successRate)[0];
        if (hardestExercise && hardestExercise.successRate < 40) {
            insights.push({
                type: 'warning',
                icon: '⚠️',
                title: `Exercice difficile : "${hardestExercise.title}"`,
                description: `Seulement ${hardestExercise.successRate}% de réussite (${hardestExercise.studentsAttempted} tentatives). Envisagez de simplifier ou d'ajouter des explications.`
            });
        }

        // Exercice le plus réussi
        const easiestExercise = exerciseAnalytics
            .filter(e => e.studentsAttempted >= 2)
            .sort((a, b) => b.successRate - a.successRate)[0];
        if (easiestExercise && easiestExercise.successRate > 90) {
            insights.push({
                type: 'success',
                icon: '🌟',
                title: `Excellent : "${easiestExercise.title}"`,
                description: `${easiestExercise.successRate}% de réussite ! Les étudiants maîtrisent cette notion.`
            });
        }

        // Étudiants inactifs
        const inactiveStudents = studentAnalytics.filter(s => s.exercisesAttempted === 0);
        if (inactiveStudents.length > 0) {
            insights.push({
                type: 'warning',
                icon: '😴',
                title: `${inactiveStudents.length} étudiant(s) sans activité`,
                description: `${inactiveStudents.map(s => s.student.firstname).join(', ')} n'ont pas encore commencé. Un rappel serait utile.`
            });
        }

        // Top performers
        const topStudents = studentAnalytics
            .filter(s => s.progress >= 80 && s.avgScore >= 8)
            .sort((a, b) => b.avgScore - a.avgScore)
            .slice(0, 3);
        if (topStudents.length > 0) {
            insights.push({
                type: 'success',
                icon: '🏆',
                title: 'Meilleurs étudiants',
                description: `${topStudents.map(s => `${s.student.firstname} (${s.avgScore}/10)`).join(', ')} excellent !`
            });
        }

        // Étudiants en difficulté
        const struggling = studentAnalytics
            .filter(s => s.exercisesAttempted >= 3 && s.avgScore < 4)
            .sort((a, b) => a.avgScore - b.avgScore);
        if (struggling.length > 0) {
            insights.push({
                type: 'warning',
                icon: '📉',
                title: `${struggling.length} étudiant(s) en difficulté`,
                description: `${struggling.map(s => `${s.student.firstname} (${s.avgScore}/10)`).join(', ')} ont besoin d'accompagnement.`
            });
        }

        // Taux de complétion global
        if (completionRate > 70) {
            insights.push({
                type: 'success',
                icon: '📊',
                title: 'Bonne progression globale',
                description: `${completionRate}% de complétion. La classe avance bien !`
            });
        } else if (completionRate < 30 && totalExercises > 0 && totalStudents > 0) {
            insights.push({
                type: 'suggestion',
                icon: '💡',
                title: 'Complétion faible',
                description: `Seulement ${completionRate}%. Envisagez d'encourager les étudiants ou de vérifier la difficulté des exercices.`
            });
        }

        // Suggestion d'exercices manquants
        if (totalExercises === 0 && totalStudents > 0) {
            insights.push({
                type: 'suggestion',
                icon: '✏️',
                title: 'Pas encore d\'exercices',
                description: 'Ajoutez des exercices à vos cours pour suivre la progression de vos étudiants.'
            });
        }

        // Score distribution
        const scoreRanges = {
            excellent: gradedSubmissions.filter(s => (s.score || 0) >= 8).length,
            good: gradedSubmissions.filter(s => (s.score || 0) >= 5 && (s.score || 0) < 8).length,
            struggling: gradedSubmissions.filter(s => (s.score || 0) >= 2 && (s.score || 0) < 5).length,
            failing: gradedSubmissions.filter(s => (s.score || 0) < 2).length,
        };

        return successResponse("Analytics générées", {
            overview: {
                totalStudents,
                totalExercises,
                totalSubmissions,
                avgScore,
                completionRate,
                scoreDistribution: scoreRanges,
            },
            students: studentAnalytics.sort((a, b) => b.progress - a.progress),
            exercises: exerciseAnalytics.sort((a, b) => a.successRate - b.successRate),
            insights,
        });

    } catch (error) {
        console.error("Erreur analytics:", error);
        return serverErrorResponse("Erreur serveur", error instanceof Error ? error.message : undefined);
    }
}
