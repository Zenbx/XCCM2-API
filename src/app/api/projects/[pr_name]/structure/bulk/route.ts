/**
 * Import bulk de structure (Agent IA) — crée Parties → Notions en un appel
 */

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';
import prisma from '@/lib/prisma';
import { cacheService } from '@/services/cache-service';
import { realtimeService } from '@/services/realtime-service';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
  serverErrorResponse,
} from '@/utils/api-response';

type RouteParams = { params: Promise<{ pr_name: string }> };

const bulkStructureSchema = z.object({
  parts: z.array(z.object({
    title: z.string().min(3).max(200),
    intro: z.string().optional(),
    chapters: z.array(z.object({
      title: z.string().min(1).max(200),
      intro: z.string().optional(),
      paragraphs: z.array(z.object({
        title: z.string().min(1).max(200),
        intro: z.string().optional(),
        notions: z.array(z.object({
          title: z.string().min(1).max(200),
          content: z.string().min(1),
        })).optional(),
      })).optional(),
    })).optional(),
  })).min(1),
});

function hasText(value: string | null | undefined): boolean {
  if (!value) return false;
  const stripped = value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return stripped.length >= 10;
}

function isPlaceholderContent(value: string | null | undefined): boolean {
  if (!value) return true;
  const stripped = value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  return stripped.length < 10
    || stripped.includes('contenu à compléter')
    || stripped.includes('contenu a completer');
}

async function resolveProject(pr_name: string, userId: string) {
  const projects = await prisma.project.findMany({
    where: {
      pr_name,
      OR: [
        { owner_id: userId },
        {
          invitations: {
            some: { guest_id: userId, invitation_state: 'Accepted' },
          },
        },
      ],
    },
  });
  return projects.find((p) => p.owner_id === userId) || projects[0] || null;
}

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return errorResponse('Utilisateur non authentifié', undefined, 401);
    }

    const { pr_name: encodedName } = await context.params;
    const pr_name = decodeURIComponent(encodedName);
    const project = await resolveProject(pr_name, userId);

    if (!project) {
      return notFoundResponse('Projet non trouvé');
    }

    const body = await request.json();
    const { parts } = bulkStructureSchema.parse(body);

    const stats = {
      parts: 0,
      chapters: 0,
      paragraphs: 0,
      notions: 0,
      updated: 0,
      skipped: 0,
    };

    let partCount = await prisma.part.count({ where: { parent_pr: project.pr_id } });

    for (const partData of parts) {
      let part = await prisma.part.findUnique({
        where: {
          part_title_parent_pr: {
            part_title: partData.title,
            parent_pr: project.pr_id,
          },
        },
      });

      if (!part) {
        partCount += 1;
        part = await prisma.part.create({
          data: {
            part_title: partData.title,
            part_intro: partData.intro || null,
            part_number: partCount,
            parent_pr: project.pr_id,
            owner_id: userId,
          },
        });
        stats.parts += 1;
      } else if (partData.intro && !hasText(part.part_intro)) {
        await prisma.part.update({
          where: { part_id: part.part_id },
          data: { part_intro: partData.intro },
        });
        stats.updated += 1;
      } else {
        stats.skipped += 1;
      }

      let chapterCount = await prisma.chapter.count({ where: { parent_part: part.part_id } });

      for (const chapterData of partData.chapters || []) {
        let chapter = await prisma.chapter.findUnique({
          where: {
            parent_part_chapter_title: {
              chapter_title: chapterData.title,
              parent_part: part.part_id,
            },
          },
        });

        if (!chapter) {
          chapterCount += 1;
          chapter = await prisma.chapter.create({
            data: {
              chapter_title: chapterData.title,
              chapter_intro: chapterData.intro || null,
              chapter_number: chapterCount,
              parent_part: part.part_id,
              owner_id: userId,
            },
          });
          stats.chapters += 1;
        } else if (chapterData.intro && !hasText(chapter.chapter_intro)) {
          await prisma.chapter.update({
            where: { chapter_id: chapter.chapter_id },
            data: { chapter_intro: chapterData.intro },
          });
          stats.updated += 1;
        } else {
          stats.skipped += 1;
        }

        let paraCount = await prisma.paragraph.count({ where: { parent_chapter: chapter.chapter_id } });

        for (const paraData of chapterData.paragraphs || []) {
          let paragraph = await prisma.paragraph.findFirst({
            where: {
              parent_chapter: chapter.chapter_id,
              para_name: paraData.title,
            },
          });

          if (!paragraph) {
            paraCount += 1;
            paragraph = await prisma.paragraph.create({
              data: {
                para_name: paraData.title,
                para_intro: paraData.intro || null,
                para_number: paraCount,
                parent_chapter: chapter.chapter_id,
                owner_id: userId,
              },
            });
            stats.paragraphs += 1;
          } else if (paraData.intro && !hasText(paragraph.para_intro)) {
            await prisma.paragraph.update({
              where: { para_id: paragraph.para_id },
              data: { para_intro: paraData.intro },
            });
            stats.updated += 1;
          } else {
            stats.skipped += 1;
          }

          let notionCount = await prisma.notion.count({ where: { parent_para: paragraph.para_id } });

          for (const notionData of paraData.notions || []) {
            const existingNotion = await prisma.notion.findUnique({
              where: {
                parent_para_notion_name: {
                  notion_name: notionData.title,
                  parent_para: paragraph.para_id,
                },
              },
            });

            if (existingNotion) {
              if (notionData.content && isPlaceholderContent(existingNotion.notion_content)) {
                await prisma.notion.update({
                  where: { notion_id: existingNotion.notion_id },
                  data: { notion_content: notionData.content },
                });
                stats.updated += 1;
              } else {
                stats.skipped += 1;
              }
              continue;
            }

            notionCount += 1;
            await prisma.notion.create({
              data: {
                notion_name: notionData.title,
                notion_content: notionData.content,
                notion_number: notionCount,
                parent_para: paragraph.para_id,
                owner_id: userId,
              },
            });
            stats.notions += 1;
          }
        }
      }
    }

    await realtimeService.broadcastStructureChange(pr_name, 'STRUCTURE_CHANGED', {
      type: 'bulk',
      action: 'created',
      stats,
    });
    await cacheService.invalidateProjectStructure(pr_name);

    return successResponse('Structure importée avec succès', { stats }, 201);
  } catch (error) {
    if (error instanceof ZodError) {
      const errors: Record<string, string[]> = {};
      error.issues.forEach((err) => {
        const field = err.path.join('.');
        if (!errors[field]) errors[field] = [];
        errors[field].push(err.message);
      });
      return validationErrorResponse(errors);
    }

    console.error('[Bulk Structure] Error:', error);
    return serverErrorResponse(
      'Erreur lors de l\'import bulk de la structure',
      error instanceof Error ? error.message : undefined
    );
  }
}
