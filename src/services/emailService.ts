import nodemailer from "nodemailer";

/**
 * Convention SMTP unique (alignée avec src/lib/email.ts et .env.example) :
 * SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, FROM_EMAIL
 * Fallbacks legacy : SMTP_PASS, SMTP_FROM
 */
function getSmtpPass(): string | undefined {
    return process.env.SMTP_PASSWORD || process.env.SMTP_PASS;
}

function getFromAddress(): string {
    return (
        process.env.FROM_EMAIL ||
        process.env.SMTP_FROM ||
        process.env.SMTP_USER ||
        "noreply@xccm2.local"
    );
}

function getTransporter() {
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const user = process.env.SMTP_USER;
    const pass = getSmtpPass();

    if (!user || !pass) {
        throw new Error(
            "SMTP configuration incomplete: set SMTP_USER and SMTP_PASSWORD (or SMTP_PASS)"
        );
    }

    return nodemailer.createTransport({
        host,
        port,
        secure: process.env.SMTP_SECURE === "true" || port === 465,
        auth: { user, pass },
    });
}

export const sendPasswordResetEmail = async (
    to: string,
    resetToken: string
) => {
    const frontendUrl =
        process.env.FRONTEND_URL ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        "http://localhost:3000";
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    const mailOptions = {
        from: getFromAddress(),
        to,
        subject: "Réinitialisation de votre mot de passe - XCCM2",
        html: `
            <div style="font-family: Arial, sans-serif; background-color: #FDFCFB; padding: 40px 20px; color: #333; text-align: center;">
                <div style="max-width: 500px; margin: 0 auto; background-color: #fff; border-radius: 12px; padding: 30px; border: 1px solid #eee;">
                    <h2 style="color: #99334C; margin-top: 0;">Réinitialisation de mot de passe</h2>
                    <p>Bonjour,</p>
                    <p>Une demande de réinitialisation de mot de passe a été effectuée pour votre compte XCCM2.</p>
                    <p>Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetLink}" style="background-color: #99334C; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; display: inline-block;">Réinitialiser mon mot de passe</a>
                    </div>
                    <p style="font-size: 13px; color: #888;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
                    <p style="font-size: 13px; color: #888; margin-top: 20px; word-break: break-all;">
                        Ou copiez ce lien : <br/>
                        <a href="${resetLink}" style="color: #99334C;">${resetLink}</a>
                    </p>
                </div>
            </div>
        `,
    };

    try {
        await getTransporter().sendMail(mailOptions);
    } catch (error) {
        console.error("Erreur lors de l'envoi de l'email de reset:", error);
        throw new Error("L'envoi de l'email a échoué.");
    }
};
