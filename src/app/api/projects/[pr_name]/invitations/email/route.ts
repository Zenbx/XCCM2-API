/**
 * @fileoverview Route API pour envoyer une invitation par email
 * POST /api/projects/[pr_name]/invitations/email
 * 
 * Documentation Swagger dans: src/lib/swagger-invitations.ts
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    validationErrorResponse,
    serverErrorResponse,
} from "@/utils/api-response";
import { sendInvitationSchema } from "@/utils/validation";
import {
    createInvitation,
    prepareInvitationEmailData,
} from "@/utils/invitation-helpers";
import { sendInvitationEmail } from "@/lib/email";
import { ZodError } from "zod";


export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ pr_name: string }> }
) {
    try {
        // Récupérer l'userId depuis le header (injecté par le middleware)
        const userId = request.headers.get("x-user-id");
        if (!userId) {
            return errorResponse("Non authentifié", undefined, 401);
        }

        const { pr_name: encodedName } = await params;
        const pr_name = decodeURIComponent(encodedName);

        // Valider le body
        const body = await request.json();
        const validatedData = sendInvitationSchema.parse(body);

        // Récupérer le projet
        const project = await prisma.project.findUnique({
            where: {
                pr_name_owner_id: {
                    pr_name,
                    owner_id: userId,
                },
            },
            include: {
                owner: true,
                invitations: {
                    where: {
                        invitation_state: "Accepted",
                    },
                },
            },
        });

        if (!project) {
            return errorResponse("Projet non trouvé ou vous n'êtes pas autorisé à y accéder", undefined, 404);
        }

        // Vérifier qu'il n'y a qu'une seule personne invitée (max)

        // Vérifier qu'il n'y a qu'une seule personne invitée (max)
        if (project.invitations.length > 0) {
            return errorResponse(
                "Un collaborateur est déjà assigné à ce projet. Un seul collaborateur est autorisé par projet.",
                undefined,
                409
            );
        }

        // Vérifier que l'email n'appartient pas à l'utilisateur lui-même
        const invitingUser = await prisma.user.findUnique({
            where: { email: validatedData.guestEmail },
        });

        if (!invitingUser) {
            return errorResponse(
                "Cet utilisateur n'existe pas dans le système",
                undefined,
                404
            );
        }

        if (invitingUser.user_id === userId) {
            return errorResponse(
                "Vous ne pouvez pas vous inviter vous-même",
                undefined,
                400
            );
        }

        // Créer l'invitation
        const invitation = await createInvitation(
            project.pr_id,
            invitingUser.user_id,
            userId
        );

        // Récupérer l'invitation avec les relations complètes
        const invitationWithRelations = await prisma.invitation.findUnique({
            where: { id: invitation.id },
            include: {
                project: true,
                guest: true,
                host: true,
            },
        });

        if (!invitationWithRelations) {
            throw new Error("Erreur lors de la récupération de l'invitation");
        }

        // Préparer les données pour l'email
        const baseUrl =
            process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
        const emailData = prepareInvitationEmailData(
            invitationWithRelations,
            baseUrl
        );

        // Envoyer l'email
        try {
            await sendInvitationEmail(emailData);
        } catch (emailError) {
            console.error("Erreur lors de l'envoi de l'email:", emailError);
            // Ne pas échouer complètement, l'invitation est créée mais l'email n'est pas envoyé
            return successResponse(
                "Invitation créée mais l'email n'a pas pu être envoyé",
                {
                    invitation: {
                        id: invitationWithRelations.id,
                        guest_email: invitationWithRelations.guest.email,
                        token: invitationWithRelations.invitation_token,
                        status: invitationWithRelations.invitation_state,
                    },
                    warning:
                        "L'invitation a été créée mais l'email n'a pas pu être envoyé. Veuillez vérifier la configuration SMTP.",
                },
                201
            );
        }

        return successResponse(
            "Invitation envoyée avec succès",
            {
                invitation: {
                    id: invitationWithRelations.id,
                    guest_email: invitationWithRelations.guest.email,
                    token: invitationWithRelations.invitation_token,
                    status: invitationWithRelations.invitation_state,
                },
            },
            201
        );
    } catch (error) {
        if (error instanceof ZodError) {
            const errorMap = error.issues.reduce((acc: Record<string, string[]>, issue) => {
                const path = issue.path.join(".");
                if (!acc[path]) acc[path] = [];
                acc[path].push(issue.message);
                return acc;
            }, {});
            return validationErrorResponse(errorMap);
        }

        if (error instanceof Error && error.message.includes("déjà existante")) {
            return errorResponse(error.message, undefined, 409);
        }

        console.error("Erreur lors de l'envoi de l'invitation:", error);
        return serverErrorResponse(
            error instanceof Error
                ? error.message
                : "Erreur lors de l'envoi de l'invitation"
        );
    }
}
