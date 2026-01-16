import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    successResponse,
    notFoundResponse,
    serverErrorResponse,
} from "@/utils/api-response";

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) {
            // Even if not logged in, we might want to count views, but user logic implies unique per account?
            // "on compte une vue lorsque une personne dun compte a consulter au moins une fois" -> implies logged in.
            return notFoundResponse("User ID required for tracking views");
        }

        const docId = params.id;

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
