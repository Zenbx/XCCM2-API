import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import prisma from "@/lib/prisma";
import { generateToken, toPublicUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        // 1. Check Session (Server-side cookies work here because we are on the API domain)
        const session = await getServerSession(authOptions);

        // Define Frontend Origin
        const frontendUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://xccm-2.vercel.app";

        if (!session || !session.user || !session.user.email) {
            console.error("[Bridge] No session found");
            const mode = request.nextUrl.searchParams.get("mode") || "login";
            const redirectPath = mode === "register" ? "/register" : "/login";
            return NextResponse.redirect(`${frontendUrl}${redirectPath}?error=SessionMissing`);
        }

        // 2. Get User from DB
        let user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        const mode = request.nextUrl.searchParams.get("mode") || "login";

        // Logic depending on Mode (Login vs Register)
        if (!user) {
            if (mode === "register") {
                console.log("[Bridge] Creating new user via OAuth registration:", session.user.email);

                // Extraire les noms du profil session si possible
                const nameParts = (session.user.name || "").split(" ");
                const firstName = nameParts[0] || "";
                const lastName = nameParts.slice(1).join(" ") || "";

                user = await prisma.user.create({
                    data: {
                        email: session.user.email,
                        firstname: firstName,
                        lastname: lastName,
                        profile_picture: session.user.image || null,
                        // Le mot de passe reste null ou généré pour OAuth
                    }
                });
            } else {
                console.error("[Bridge] User not found during login mode:", session.user.email);
                return NextResponse.redirect(`${frontendUrl}/login?error=UserNotFound`);
            }
        } else {
            // L'utilisateur existe déjà
            if (mode === "register") {
                // Si on tente de s'inscrire alors que le compte existe déjà, on redirige avec succès (car le but est d'être connecté)
                // Mais on peut optionnellement mettre à jour le profil si des infos manquent
            }

            // [FIX] Ne pas écraser le nom s'il existe déjà !
            const nameParts = (session.user.name || "").split(" ");
            const sessionFirst = nameParts[0] || "";
            const sessionLast = nameParts.slice(1).join(" ") || "";

            const shouldUpdate = (!user.firstname && sessionFirst) || (!user.lastname && sessionLast) || (!user.profile_picture && session.user.image);

            if (shouldUpdate) {
                user = await prisma.user.update({
                    where: { user_id: user.user_id },
                    data: {
                        firstname: user.firstname || sessionFirst,
                        lastname: user.lastname || sessionLast,
                        profile_picture: user.profile_picture || session.user.image,
                    }
                });
            }
        }

        // 3. Generate Token
        const publicUser = toPublicUser(user);
        const token = await generateToken(publicUser);

        // 4. Redirect to Frontend with Token
        const redirectUrl = new URL(`${frontendUrl}/auth/callback`);
        redirectUrl.searchParams.set("token", token);
        if (mode) redirectUrl.searchParams.set("mode", mode);

        console.log("[Bridge] Redirecting to:", redirectUrl.toString());
        return NextResponse.redirect(redirectUrl);

    } catch (error) {
        console.error("[Bridge] Error:", error);
        const mode = request.nextUrl.searchParams.get("mode") || "login";
        const frontendUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://xccm-2.vercel.app";
        const redirectPath = mode === "register" ? "/register" : "/login";
        return NextResponse.redirect(`${frontendUrl}${redirectPath}?error=BridgeError`);
    }
}
