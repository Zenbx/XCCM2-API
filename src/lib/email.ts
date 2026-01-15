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
            to: email,
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
    <title>Invitation de projet</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f7f7f9; font-family: 'Roboto', Helvetica, Arial, sans-serif;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f7f7f9; padding: 40px 10px;">
        <tr>
            <td align="center">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #eeeeee;">
                    
                    <tr>
                        <td align="center" style="padding: 40px 30px 20px 30px;">
                            <div style="background-color: #99334c; width: 48px; height: 48px; border-radius: 12px; margin-bottom: 20px; display: inline-block;">
                                <span style="color: #ffffff; line-height: 48px; font-size: 24px;">📨</span>
                            </div>
                            <h1 style="margin: 0; color: #1c1b1f; font-size: 24px; font-weight: 500; letter-spacing: 0.2px;">
                                Nouvelle invitation
                            </h1>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 0 40px 30px 40px; color: #49454f; font-size: 16px; line-height: 1.6;">
                            <p style="margin: 0 0 20px 0;">Bonjour <strong>${data.guestFirstname}</strong>,</p>
                            <p style="margin: 0 0 24px 0;">
                                <strong>${data.hostFirstname}</strong> vous propose de rejoindre son équipe sur la plateforme XCCM.
                            </p>

                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #E1C2C9; border-radius: 12px;">
                                <tr>
                                    <td style="padding: 24px;">
                                        <span style="display: block; font-size: 11px; font-weight: 700; color: #49454f; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px;">Projet en attente</span>
                                        <span style="display: block; font-size: 20px; font-weight: 600; color: #1c1b1f;">${data.projectName}</span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td align="center" style="padding: 10px 40px 40px 40px;">
                            <table border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" bgcolor="#99334c" style="border-radius: 100px;">
                                        <a href="${data.invitationLink}" target="_blank" style="display: inline-block; padding: 16px 40px; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; text-transform: uppercase; letter-spacing: 1px;">
                                            Voir l'invitation
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin-top: 24px; font-size: 12px; color: #79747e; max-width: 300px; line-height: 1.4;">
                                En rejoignant ce projet, vous pourrez collaborer et modifier les contenus partagés.
                            </p>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 30px; background-color: #fafafb; border-top: 1px solid #eeeeee; text-align: center; color: #79747e; font-size: 12px;">
                            <p style="margin: 0 0 8px 0; font-weight: 600;">XCCM — Plateforme Interculturelle</p>
                            <p style="margin: 0;">Cet e-mail est destiné à ${data.guestEmail}</p>
                            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eeeeee;">
                                <p style="font-size: 10px; color: #79747e; opacity: 0.7;">
                                    Si le bouton ne fonctionne pas, copiez ce lien :<br>
                                    <span style="color: #99334c;">${data.invitationLink}</span>
                                </p>
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
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

