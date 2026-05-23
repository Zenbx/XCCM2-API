import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { generateToken, toPublicUser } from "@/lib/auth";
import { successResponse, unauthorizedResponse, validationErrorResponse, serverErrorResponse } from "@/utils/api-response";

/**
 * POST /api/auth/external
 *
 * Permet à un plugin externe (Moodle PHP, Moodle Client Node.js, LTI…)
 * d'obtenir un JWT XCCM2 pour un utilisateur identifié côté plugin.
 *
 * Le plugin s'authentifie lui-même via un secret partagé (PLUGIN_API_SECRET).
 * Si l'utilisateur n'existe pas encore en base, il est créé automatiquement
 * avec un mot de passe null (connexion uniquement via plugin).
 *
 * Body JSON attendu :
 * {
 *   api_secret    : string  — secret partagé configuré dans les deux systèmes
 *   email         : string  — email de l'utilisateur côté LMS
 *   firstname     : string  — prénom
 *   lastname      : string  — nom
 *   source        : string  — identifiant de la plateforme ("moodle" | "moodle_client" | ...)
 *   external_id?  : string  — ID opaque de l'utilisateur dans la plateforme source
 * }
 *
 * Réponse 200 :
 * { success: true, data: { token: string, user: PublicUser } }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { api_secret, email, firstname, lastname, source, external_id } = body;

        // ── 1. Validation des champs obligatoires ──────────────────────────────
        if (!api_secret || !email || !firstname || !lastname || !source) {
            return validationErrorResponse("Champs requis manquants : api_secret, email, firstname, lastname, source");
        }

        // ── 2. Vérification du secret partagé ──────────────────────────────────
        const expectedSecret = process.env.PLUGIN_API_SECRET;
        if (!expectedSecret) {
            console.error("[/api/auth/external] PLUGIN_API_SECRET non configuré");
            return serverErrorResponse("Configuration serveur incomplète");
        }
        if (api_secret !== expectedSecret) {
            return unauthorizedResponse("Secret invalide");
        }

        // ── 3. Trouver ou créer l'utilisateur ──────────────────────────────────
        let user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    email,
                    firstname,
                    lastname,
                    // Pas de mot de passe : l'auth passe exclusivement par le plugin
                    password: null,
                    role: "user",
                    // On stocke l'origine pour traçabilité
                    org: source,
                },
            });
        } else {
            // Mise à jour du nom si l'annuaire LMS a changé
            if (user.firstname !== firstname || user.lastname !== lastname) {
                user = await prisma.user.update({
                    where: { user_id: user.user_id },
                    data: { firstname, lastname },
                });
            }
        }

        // ── 4. Génération du JWT XCCM2 ─────────────────────────────────────────
        const publicUser = toPublicUser(user);
        const token = await generateToken(publicUser);

        return successResponse({ token, user: publicUser });
    } catch (err: any) {
        console.error("[/api/auth/external] Erreur :", err);
        return serverErrorResponse(err.message || "Erreur interne");
    }
}
