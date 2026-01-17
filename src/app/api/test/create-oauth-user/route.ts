import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
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
        user_id: `test_${Date.now()}`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "User created/updated",
      user,
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
