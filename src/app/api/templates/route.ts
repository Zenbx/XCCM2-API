/**
 * @openapi
 * /api/templates:
 *   get:
 *     tags:
 *       - Projects
 *     summary: Lister les modèles (Templates)
 *     description: Récupère tous les modèles publics utilisables pour créer de nouveaux projets.
 *     responses:
 *       200:
 *         description: Liste des modèles récupérée
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
    try {
        const templates = await prisma.template.findMany({
            where: {
                is_public: true,
            },
            include: {
                creator: {
                    select: {
                        user_id: true,
                        firstname: true,
                        lastname: true,
                        email: true,
                    },
                },
            },
            orderBy: {
                created_at: 'desc',
            },
        });

        return NextResponse.json({
            success: true,
            message: 'Templates récupérés avec succès',
            data: {
                templates,
                count: templates.length,
            },
        });
    } catch (error: any) {
        console.error('Error fetching templates:', error);
        return NextResponse.json(
            {
                success: false,
                message: 'Erreur lors de la récupération des templates',
                error: error.message,
            },
            { status: 500 }
        );
    }
}
