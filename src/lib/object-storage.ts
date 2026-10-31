/**
 * Stockage objet unifié :
 *  - Supabase Storage si SUPABASE_URL + SERVICE_ROLE_KEY (Vercel / cloud)
 *  - sinon MinIO / S3 (datacenter Gandal, Docker)
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
    getSupabase,
    isSupabaseConfigured,
    SUPABASE_DOCUMENTS_BUCKET,
    SUPABASE_UPLOADS_BUCKET,
} from "./supabase";

export const DOCUMENTS_BUCKET = isSupabaseConfigured()
    ? SUPABASE_DOCUMENTS_BUCKET
    : process.env.MINIO_BUCKET_DOCUMENTS ||
      process.env.MINIO_BUCKET ||
      "xccm-documents";

export const UPLOADS_BUCKET = isSupabaseConfigured()
    ? SUPABASE_UPLOADS_BUCKET
    : process.env.MINIO_BUCKET_UPLOADS || "xccm-uploads";

let s3Client: S3Client | null = null;

function getEndpoint(): string {
    return process.env.MINIO_ENDPOINT || "http://127.0.0.1:9000";
}

function getS3Client(): S3Client {
    if (s3Client) return s3Client;

    const accessKey = process.env.MINIO_ACCESS_KEY;
    const secretKey = process.env.MINIO_SECRET_KEY;
    if (!accessKey || !secretKey) {
        throw new Error(
            "MINIO_ACCESS_KEY et MINIO_SECRET_KEY doivent être définies " +
                "(ou configurez SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)"
        );
    }

    s3Client = new S3Client({
        endpoint: getEndpoint(),
        region: process.env.MINIO_REGION || "us-east-1",
        credentials: {
            accessKeyId: accessKey,
            secretAccessKey: secretKey,
        },
        forcePathStyle: true,
    });

    return s3Client;
}

function getMinioPublicUrl(bucket: string, key: string): string {
    const root = (process.env.MINIO_PUBLIC_URL || getEndpoint()).replace(
        /\/$/,
        ""
    );
    return `${root}/${bucket}/${key}`;
}

async function uploadToSupabase(
    bucket: string,
    key: string,
    body: Buffer,
    contentType: string
): Promise<{ url: string; key: string; size: number }> {
    const supabase = getSupabase();
    const { error } = await supabase.storage.from(bucket).upload(key, body, {
        contentType,
        upsert: true,
    });

    if (error) {
        throw new Error(`Erreur upload Supabase: ${error.message}`);
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(key);
    return {
        url: data.publicUrl,
        key,
        size: body.length,
    };
}

async function uploadToMinio(
    bucket: string,
    key: string,
    body: Buffer,
    contentType: string
): Promise<{ url: string; key: string; size: number }> {
    await getS3Client().send(
        new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
        })
    );

    return {
        url: getMinioPublicUrl(bucket, key),
        key,
        size: body.length,
    };
}

/** URL publique (lecture) — utile hors upload */
export function getPublicUrl(bucket: string, key: string): string {
    if (isSupabaseConfigured()) {
        const { data } = getSupabase().storage.from(bucket).getPublicUrl(key);
        return data.publicUrl;
    }
    return getMinioPublicUrl(bucket, key);
}

export async function uploadObject(
    bucket: string,
    key: string,
    body: Buffer,
    contentType: string
): Promise<{ url: string; key: string; size: number }> {
    if (isSupabaseConfigured()) {
        return uploadToSupabase(bucket, key, body, contentType);
    }
    return uploadToMinio(bucket, key, body, contentType);
}
