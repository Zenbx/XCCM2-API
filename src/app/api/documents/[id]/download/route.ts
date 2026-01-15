/**
 * @swagger
 * /api/documents/{id}/download:
 *   get:
 *     tags:
 *       - Documents
 *     summary: Télécharger un document PDF
 *     description: Télécharge un document stocké sur Supabase via son identifiant
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Fichier PDF
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès refusé
 *       404:
 *         description: Document introuvable
 *       500:
 *         description: Erreur serveur
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import prisma from "@/lib/prisma";

/* =========================
   Supabase (serveur)
========================= */

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/* =========================
   Utilitaire : extraire bucket + path depuis url_content
========================= */

function extractBucketAndPath(urlString: string) {
  try {
    const url = new URL(urlString);

    // /storage/v1/object/sign/{bucket}/{path}
    const parts = url.pathname.split("/");

    const objectIndex = parts.findIndex(p => p === "object");
    if (objectIndex === -1) return null;

    const bucket = parts[objectIndex + 2];
    const path = parts.slice(objectIndex + 3).join("/");

    if (!bucket || !path) return null;

    return { bucket, path };
  } catch {
    return null;
  }
}

/* =========================
   GET /api/documents/:id/download
========================= */

export async function GET(
  request: NextRequest,
  context: { params: any }
) {
  try {
    // 🔹 Déballer params
    const unwrappedParams = await context.params;
    const docId = unwrappedParams?.id;
    if (!docId) {
      return NextResponse.json({ success: false, message: "ID manquant" }, { status: 400 });
    }

    /* ---------- Auth Bearer ---------- */
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, message: "Non authentifié" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];

    // Ici tu peux ajouter une vérification du token si nécessaire
    // Exemple basique : juste log pour test
    console.log("Token reçu :", token);

    /* ---------- DB (Prisma) ---------- */
    const document = await prisma.document.findUnique({
      where: { doc_id: docId },
    });

    if (!document) {
      return NextResponse.json({ success: false, message: "Document introuvable" }, { status: 404 });
    }

    /* ---------- URL Supabase ---------- */
    const extracted = extractBucketAndPath(document.url_content);
    if (!extracted) {
      return NextResponse.json({ success: false, message: "URL de stockage invalide" }, { status: 500 });
    }
    const { bucket, path } = extracted;

    /* ---------- Supabase Storage ---------- */
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) {
      console.error("Erreur Supabase:", error);
      return NextResponse.json({ success: false, message: "Fichier introuvable sur Supabase" }, { status: 404 });
    }

    // 🔹 Conversion en Uint8Array pour binaire
    const arrayBuffer = await data.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    /* ---------- Stats ---------- */
    await prisma.document.update({
      where: { doc_id: document.doc_id },
      data: { downloaded: { increment: 1 } },
    });

    /* ---------- Nom du fichier ---------- */
    const fileName = document.doc_name.endsWith(".pdf") ? document.doc_name : `${document.doc_name}.pdf`;

    console.log(`✅ ${fileName} téléchargé`);

    /* ---------- Réponse binaire PDF ---------- */
    return new NextResponse(uint8Array, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": uint8Array.length.toString(),
        "Cache-Control": "private, no-store",
      },
    });

  } catch (error) {
    console.error("Erreur serveur:", error);
    return NextResponse.json({ success: false, message: "Erreur interne du serveur" }, { status: 500 });
  }
}
