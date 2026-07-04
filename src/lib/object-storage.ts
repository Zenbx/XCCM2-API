/**
 * Stockage objet S3-compatible (MinIO en production datacenter).
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export const DOCUMENTS_BUCKET =
    process.env.MINIO_BUCKET_DOCUMENTS || process.env.MINIO_BUCKET || 'xccm-documents';

export const UPLOADS_BUCKET =
    process.env.MINIO_BUCKET_UPLOADS || 'xccm-uploads';

let s3Client: S3Client | null = null;

function getEndpoint(): string {
    return process.env.MINIO_ENDPOINT || 'http://127.0.0.1:9000';
}

function getClient(): S3Client {
    if (s3Client) return s3Client;

    const accessKey = process.env.MINIO_ACCESS_KEY;
    const secretKey = process.env.MINIO_SECRET_KEY;
    if (!accessKey || !secretKey) {
        throw new Error(
            'MINIO_ACCESS_KEY et MINIO_SECRET_KEY doivent être définies pour le stockage objet'
        );
    }

    s3Client = new S3Client({
        endpoint: getEndpoint(),
        region: process.env.MINIO_REGION || 'us-east-1',
        credentials: {
            accessKeyId: accessKey,
            secretAccessKey: secretKey,
        },
        forcePathStyle: true,
    });

    return s3Client;
}

/** URL publique servie aux clients (souvent via Nginx /storage/) */
export function getPublicUrl(bucket: string, key: string): string {
    const root = (process.env.MINIO_PUBLIC_URL || getEndpoint()).replace(/\/$/, '');
    return `${root}/${bucket}/${key}`;
}

export async function uploadObject(
    bucket: string,
    key: string,
    body: Buffer,
    contentType: string
): Promise<{ url: string; key: string; size: number }> {
    await getClient().send(
        new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
        })
    );

    return {
        url: getPublicUrl(bucket, key),
        key,
        size: body.length,
    };
}
