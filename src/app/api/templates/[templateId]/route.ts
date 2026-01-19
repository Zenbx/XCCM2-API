/**
 * GET /api/templates/[templateId]
 * Récupérer un template par son ID
 * 
 * PATCH /api/templates/[templateId]
 * Mettre à jour un template (créateur seulement)
 * 
 * DELETE /api/templates/[templateId]
 * Supprimer un template (créateur seulement)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ templateId: string }> }
) {
    try {
        const { templateId } = await params;

        const template = await prisma.template.findUnique({
            where: { template_id: templateId },
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
        });

        if (!template) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Template non trouvé',
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Template récupéré avec succès',
            data: { template },
        });
    } catch (error: any) {
        console.error('Error fetching template:', error);
        return NextResponse.json(
            {
                success: false,
                message: 'Erreur lors de la récupération du template',
                error: error.message,
            },
            { status: 500 }
        );
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ templateId: string }> }
) {
    try {
        const authHeader = req.headers.get("Authorization");
        const token = extractTokenFromHeader(authHeader);
        const payload = token ? await verifyToken(token) : null;

        if (!payload) {
            return NextResponse.json(
                { success: false, message: 'Non authentifié' },
                { status: 401 }
            );
        }

        const { templateId } = await params;
        const body = await req.json();

        // Vérifier que l'utilisateur est le créateur
        const existingTemplate = await prisma.template.findUnique({
            where: { template_id: templateId },
        });

        if (!existingTemplate) {
            return NextResponse.json(
                { success: false, message: 'Template non trouvé' },
                { status: 404 }
            );
        }

        if (existingTemplate.creator_id !== payload.userId) {
            return NextResponse.json(
                { success: false, message: 'Non autorisé' },
                { status: 403 }
            );
        }

        const updatedTemplate = await prisma.template.update({
            where: { template_id: templateId },
            data: {
                template_name: body.template_name,
                description: body.description,
                category: body.category,
                is_public: body.is_public,
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
        });

        return NextResponse.json({
            success: true,
            message: 'Template mis à jour avec succès',
            data: { template: updatedTemplate },
        });
    } catch (error: any) {
        console.error('Error updating template:', error);
        return NextResponse.json(
            {
                success: false,
                message: 'Erreur lors de la mise à jour du template',
                error: error.message,
            },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ templateId: string }> }
) {
    try {
        const authHeader = req.headers.get("Authorization");
        const token = extractTokenFromHeader(authHeader);
        const payload = token ? await verifyToken(token) : null;

        if (!payload) {
            return NextResponse.json(
                { success: false, message: 'Non authentifié' },
                { status: 401 }
            );
        }

        const { templateId } = await params;

        // Vérifier que l'utilisateur est le créateur
        const existingTemplate = await prisma.template.findUnique({
            where: { template_id: templateId },
        });

        if (!existingTemplate) {
            return NextResponse.json(
                { success: false, message: 'Template non trouvé' },
                { status: 404 }
            );
        }

        if (existingTemplate.creator_id !== payload.userId) {
            return NextResponse.json(
                { success: false, message: 'Non autorisé' },
                { status: 403 }
            );
        }

        await prisma.template.delete({
            where: { template_id: templateId },
        });

        return NextResponse.json({
            success: true,
            message: 'Template supprimé avec succès',
        });
    } catch (error: any) {
        console.error('Error deleting template:', error);
        return NextResponse.json(
            {
                success: false,
                message: 'Erreur lors de la suppression du template',
                error: error.message,
            },
            { status: 500 }
        );
    }
}
