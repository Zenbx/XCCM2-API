import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { verifyJwtToken } from "@/lib/auth"; // Assuming auth lib exists

const prisma = new PrismaClient();

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const authHeader = req.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const token = authHeader.split(" ")[1];
        const payload = await verifyJwtToken(token);

        if (!payload) {
            return NextResponse.json({ error: "Invalid token" }, { status: 401 });
        }

        const userId = payload.id; // Adjust based on payload structure
        const docId = params.id;

        if (!docId) {
            return NextResponse.json({ error: "Missing document ID" }, { status: 400 });
        }

        // Check if like exists
        const existingLike = await prisma.like.findUnique({
            where: {
                liker_id_doc_id: {
                    liker_id: userId,
                    doc_id: docId,
                },
            },
        });

        if (existingLike) {
            // Unlike
            await prisma.like.delete({
                where: {
                    id: existingLike.id,
                },
            });
            return NextResponse.json({ liked: false });
        } else {
            // Like
            await prisma.like.create({
                data: {
                    liker_id: userId,
                    doc_id: docId,
                },
            });
            return NextResponse.json({ liked: true });
        }
    } catch (error) {
        console.error("Error toggling like:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    } finally {
        await prisma.$disconnect();
    }
}
