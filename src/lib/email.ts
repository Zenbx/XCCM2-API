/**
 * @fileoverview Utilitaire pour l'envoi d'emails avec Nodemailer
 * Gère l'envoi d'emails de confirmation de newsletter et de contact
 * Compatible avec tous les services SMTP (Gmail, Mailtrap, etc.)
 */

import { InvitationEmailData } from "@/types/invitation.types";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

/**
 * Configuration des emails
 */
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@example.com";

/**
 * Instance du transporteur Nodemailer (créée à la première utilisation)
 */
let transporter: Transporter | null = null;

/**
 * Crée et retourne une instance du transporteur SMTP
 */
function getTransporter(): Transporter {
    if (!transporter) {
        const host = process.env.SMTP_HOST;
        const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASSWORD;

        if (!host || !user || !pass) {
            throw new Error(
                "SMTP configuration is incomplete. Please set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD in your environment variables."
            );
        }

        transporter = nodemailer.createTransport({
            host,
            port,
            secure: port === 465, // true pour 465, false pour autres ports
            auth: {
                user,
                pass,
            },
        });
    }
    return transporter;
}

/**
 * Envoie un email de confirmation d'abonnement à la newsletter
 * @param email - Email du nouveau abonné
 * @returns Promesse avec le résultat de l'envoi
 */
export async function sendNewsletterConfirmation(email: string) {
    try {
        const transporter = getTransporter();

        await transporter.sendMail({
            from: FROM_EMAIL,
            to: email,
            subject: "Bienvenue sur notre newsletter !",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #333;">Bienvenue sur notre newsletter !</h2>
                    <p style="color: #666; line-height: 1.6;">
                        Merci de vous être abonné à notre newsletter. Vous recevrez désormais les dernières 
                        actualités et mises à jour directement dans votre boîte mail.
                    </p>
                    <p style="color: #666; line-height: 1.6;">
                        Si vous avez des questions, n'hésitez pas à nous <a href="${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/contact" style="color: #0066cc; text-decoration: none;">contacter</a>.
                    </p>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                    <p style="color: #999; font-size: 12px;">
                        © ${new Date().getFullYear()} XCCM2. Tous droits réservés.
                    </p>
                </div>
            `,
        });

        return { success: true };
    } catch (error) {
        console.error("Erreur lors de l'envoi de la confirmation newsletter:", error);
        throw error;
    }
}

/**
 * Envoie un email de confirmation au utilisateur qui nous contacte
 * @param email - Email du visiteur
 * @param name - Nom du visiteur
 * @param subject - Sujet du message
 * @returns Promesse avec le résultat de l'envoi
 */
export async function sendContactConfirmation(
    email: string,
    name: string,
    subject: string
) {
    try {
        const transporter = getTransporter();

        await transporter.sendMail({
            from: FROM_EMAIL,
            to: email,
            subject: `Réception de votre message : ${subject}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #333;">Nous avons reçu votre message</h2>
                    <p style="color: #666; line-height: 1.6;">
                        Bonjour ${name},
                    </p>
                    <p style="color: #666; line-height: 1.6;">
                        Merci de nous avoir contacté. Nous avons bien reçu votre message concernant 
                        "<strong>${subject}</strong>" et nous allons l'examiner attentivement.
                    </p>
                    <p style="color: #666; line-height: 1.6;">
                        Notre équipe technique vous répondra dans les plus brefs délais, généralement 
                        dans les 24 heures.
                    </p>
                    <p style="color: #666; line-height: 1.6;">
                        Cordialement,<br>
                        L'équipe XCCM2
                    </p>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                    <p style="color: #999; font-size: 12px;">
                        © ${new Date().getFullYear()} XCCM2. Tous droits réservés.
                    </p>
                </div>
            `,
        });

        return { success: true };
    } catch (error) {
        console.error("Erreur lors de l'envoi de la confirmation de contact:", error);
        throw error;
    }
}

/**
 * Envoie un email à l'équipe technique avec les détails du contact
 * @param email - Email du visiteur
 * @param name - Nom du visiteur
 * @param subject - Sujet du message
 * @param message - Contenu du message
 * @returns Promesse avec le résultat de l'envoi
 */
export async function sendContactToTeam(
    email: string,
    name: string,
    subject: string,
    message: string
) {
    try {
        const transporter = getTransporter();

        await transporter.sendMail({
            from: FROM_EMAIL,
            replyTo: email,
            subject: `[CONTACT] ${subject} - De: ${name} (${email})`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #333;">Nouveau message de contact</h2>
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>De:</strong> ${name}</p>
                        <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
                        <p style="margin: 5px 0;"><strong>Sujet:</strong> ${subject}</p>
                        <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date().toLocaleString('fr-FR')}</p>
                    </div>
                    <h3 style="color: #333; margin-top: 20px;">Message:</h3>
                    <p style="color: #666; line-height: 1.6; white-space: pre-wrap;">
                        ${message}
                    </p>
                </div>
            `,
        });

        return { success: true };
    } catch (error) {
        console.error("Erreur lors de l'envoi du message à l'équipe:", error);
        throw error;
    }
}


/**
 * Génère le contenu HTML pour l'email d'invitation
 * @param data - Données de l'invitation
 * @returns Contenu HTML de l'email
 */
function generateInvitationEmailHTML(data: InvitationEmailData): string {
    return `
        <!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        :root {
            /* Palette de couleurs dynamique */
            --primary-color: #99334c; /* Couleur principale Material */
            --on-primary: #ffffff;
            --surface-variant: rgba(153, 51, 76, 0.3);
            --on-surface-variant: #49454f;
            --surface: #ffffff;
            --text-main: #1c1b1f;
            --text-secondary: #49454f;
            --outline: #79747e;
            --bg-body: #f7f7f9;
        }

        body {
            font-family: 'Poppins', 'Roboto', 'Segoe UI', Tahoma, sans-serif;
            background-color: var(--bg-body);
            color: var(--text-main);
            margin: 0;
            padding: 0;
            line-height: 1.5;
        }

        .email-wrapper {
            width: 100%;
            padding: 40px 0;
        }

        .container {
            max-width: 560px;
            margin: 0 auto;
            background-color: var(--surface);
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            border: 1px solid rgba(0,0,0,0.05);
        }

        .header {
            padding: 32px 24px;
            text-align: center;
            background-color: var(--surface);
        }

        .header h1 {
            font-size: 22px;
            font-weight: 500;
            margin: 0;
            color: var(--text-main);
            letter-spacing: 0.1px;
        }

        .content {
            padding: 0 32px 32px 32px;
        }

        .content p {
            font-size: 16px;
            margin-bottom: 24px;
            color: var(--text-secondary);
        }

        /* Card de détails du projet - Style Material Surface Variant */
        .project-card {
            background-color: var(--surface-variant);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 32px;
        }

        .project-card-title {
            display: block;
            font-size: 14px;
            color: var(--on-surface-variant);
            margin-bottom: 4px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 700;
        }

        .project-card-value {
            font-size: 18px;
            font-weight: 500;
            color: var(--text-main);
        }

        /* Bouton Material Design (Filled Button) */
        .actions {
            text-align: center;
            margin: 32px 0;
        }

        .btn-primary {
            display: inline-block;
            background-color: var(--primary-color);
            color: var(--on-primary) !important;
            padding: 12px 24px;
            border-radius: 100px; /* Style Pill Material M3 */
            text-decoration: none;
            font-weight: 500;
            font-size: 14px;
            letter-spacing: 0.1px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            transition: box-shadow 0.2s;
        }

        /* Footer */
        .footer {
            padding: 24px;
            text-align: center;
            font-size: 12px;
            color: var(--outline);
            border-top: 1px solid rgba(0,0,0,0.05);
        }

        .raw-link {
            word-break: break-all;
            color: var(--primary-color);
            font-size: 11px;
            margin-top: 16px;
            display: block;
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="container">
            <div class="header">
                <h1>Invitation au projet</h1>
            </div>

            <div class="content">
                <p>Bonjour <strong>${data.guestFirstname}</strong>,</p>

                <p>
                    <strong>${data.hostFirstname}</strong> vous invite à collaborer sur un nouveau projet. 
                    Rejoignez l'équipe pour commencer à travailler ensemble.
                </p>

                <div class="project-card">
                    <span class="project-card-title">Nom du projet</span>
                    <span class="project-card-value">${data.projectName}</span>
                </div>

                <div class="actions">
                    <a href="${data.invitationLink}" class="btn-primary">
                        VOIR L'INVITATION
                    </a>
                </div>

                <p style="font-size: 13px; text-align: center;">
                    Vous pourrez accepter ou décliner l'invitation depuis votre tableau de bord.
                </p>
            </div>

            <div class="footer">
                <p>© 2026 XCCM — Plateforme de gestion de contenu interculturel</p>
                <p>Envoyé à ${data.guestEmail}</p>
                <span class="raw-link">Lien direct : ${data.invitationLink}</span>
            </div>
        </div>
    </div>
</body>
</html>
    `;
}

/**
 * Génère le contenu texte pour l'email d'invitation
 * @param data - Données de l'invitation
 * @returns Contenu texte de l'email
 */
// function generateInvitationEmailText(data: InvitationEmailData): string {
//     return `
// Invitation de Projet

// Bonjour ${data.guestFirstname},

// Vous avez été invité(e) sur le projet "${data.projectName}" par ${data.hostFirstname}.

// Si vous acceptez cette invitation, vous pourrez modifier et collaborer sur ce projet.

// Projet: ${data.projectName}
// Invité par: ${data.hostFirstname}

// Pour répondre à cette invitation, veuillez cliquer sur l'un des liens ci-dessous:

// ACCEPTER: ${data.acceptLink}
// DÉCLINER: ${data.declineLink}

// ---
// © 2026 XCCM - Cross-Cultural Content Management Platform
// Cet email a été envoyé à ${data.guestEmail}
//     `.trim();
// }

/**
 * Envoie un email d'invitation
 * @param data - Données de l'invitation
 * @throws {Error} Si l'envoi échoue
 */
export async function sendInvitationEmail(data: InvitationEmailData): Promise<void> {
    try {
        const transporter = getTransporter();

        const mailOptions = {
            from: process.env.SMTP_FROM,
            to: data.guestEmail,
            subject: `Invitation sur le projet "${data.projectName}" - XCCM`,
            // text: generateInvitationEmailText(data),
            html: generateInvitationEmailHTML(data),
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`Email d'invitation envoyé avec succès:`, info.messageId);
    } catch (error) {
        console.error("Erreur lors de l'envoi de l'email d'invitation:", error);
        throw new Error(
            `Impossible d'envoyer l'email d'invitation: ${error instanceof Error ? error.message : "Erreur inconnue"
            }`
        );
    }
}

