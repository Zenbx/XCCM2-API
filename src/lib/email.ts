/**
 * @fileoverview Utilitaire pour l'envoi d'emails avec Nodemailer
 * Gère l'envoi d'emails de confirmation de newsletter et de contact
 * Compatible avec tous les services SMTP (Gmail, Mailtrap, etc.)
 */

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
