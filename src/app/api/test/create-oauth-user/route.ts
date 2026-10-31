import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * Route de test uniquement — désactivée hors development.
 */
export async function POST(request: NextRequest) {
    if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    try {
        const { email, firstname, lastname } = await request.json();

        if (!email) {
            return NextResponse.json(
                { error: "Email is required" },
                { status: 400 }
            );
        }

        const user = await prisma.user.upsert({
            where: { email },
            update: {
                firstname: firstname || "",
                lastname: lastname || "",
            },
            create: {
                email,
                firstname: firstname || "",
                lastname: lastname || "",
                password: "",
            },
        });

        return NextResponse.json({
            success: true,
            message: "User created/updated",
            user,
        });
    } catch (error) {
        console.error("Error:", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
