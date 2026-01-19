import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    notFoundResponse,
    serverErrorResponse,
} from "@/utils/api-response";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: docId } = await params;
        const userId = request.headers.get("x-user-id");
        if (!userId) {
            return notFoundResponse("User ID required for tracking views");
        }

        // Check if view already exists
        const existingView = await prisma.view.findUnique({
            where: {
                viewer_id_doc_id: {
                    viewer_id: userId,
                    doc_id: docId,
                },
            },
        });

        if (!existingView) {
            // Transaction: Create view AND increment consult count
            await prisma.$transaction([
                prisma.view.create({
                    data: {
                        viewer_id: userId,
                        doc_id: docId,
                    },
                }),
                prisma.document.update({
                    where: { doc_id: docId },
                    data: { consult: { increment: 1 } },
                }),
            ]);
            return successResponse("View recorded successfully");
        }

        return successResponse("View already recorded");
    } catch (error) {
        console.error("Error recording view:", error);
        return serverErrorResponse(
            "Error recording view",
            error instanceof Error ? error.message : undefined
        );
    }
}
