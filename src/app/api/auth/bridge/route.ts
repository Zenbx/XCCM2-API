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
            return NextResponse.redirect(`${frontendUrl}/login?error=SessionMissing`);
        }

        // 2. Get User from DB
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            console.error("[Bridge] User not found in DB");
            return NextResponse.redirect(`${frontendUrl}/login?error=UserNotFound`);
        }

        // 3. Generate Token
        const publicUser = toPublicUser(user);
        const token = await generateToken(publicUser);

        // 4. Redirect to Frontend with Token
        const redirectUrl = new URL(`${frontendUrl}/auth/callback`);
        redirectUrl.searchParams.set("token", token);
        // We can also pass the user object encoded, but token is usually enough for the frontend to fetch me

        console.log("[Bridge] Redirecting to:", redirectUrl.toString());
        return NextResponse.redirect(redirectUrl);

    } catch (error) {
        console.error("[Bridge] Error:", error);
        return NextResponse.redirect(new URL("/login?error=BridgeError", request.url));
    }
}
