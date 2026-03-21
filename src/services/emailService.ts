import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export const sendPasswordResetEmail = async (to: string, resetToken: string) => {
    // Generate the frontend reset link
    const frontendUrl = process.env.FRONTEND_URL || 'https://xccm-2.vercel.app';
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    const mailOptions = {
        from: `"XCCM2 LMS" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to,
        subject: 'Réinitialisation de votre mot de passe - XCCM2',
        html: `
            <div style="font-family: Arial, sans-serif; background-color: #FDFCFB; padding: 40px 20px; color: #333 text-align: center;">
                <div style="max-width: 500px; margin: 0 auto; background-color: #fff; border-radius: 12px; padding: 30px; border: 1px solid #eee; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                    <h2 style="color: #99334C; margin-top: 0;">Réinitialisation de mot de passe</h2>
                    <p>Bonjour,</p>
                    <p>Une demande de réinitialisation de mot de passe a été effectuée pour votre compte XCCM2.</p>
                    <p>Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetLink}" style="background-color: #99334C; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; display: inline-block;">Réinitialiser mon mot de passe</a>
                    </div>
                    <p style="font-size: 13px; color: #888;">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité.</p>
                    <p style="font-size: 13px; color: #888; margin-top: 20px; word-break: break-all;">
                        Ou copiez ce lien dans votre navigateur : <br/>
                        <a href="${resetLink}" style="color: #99334C;">${resetLink}</a>
                    </p>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error("Erreur lors de l'envoi de l'email de reset:", error);
        throw new Error("L'envoi de l'email a échoué.");
    }
};
