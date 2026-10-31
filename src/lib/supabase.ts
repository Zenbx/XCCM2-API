/**
 * Client Supabase Storage (publication / uploads cloud — Vercel).
 * Optionnel : si SUPABASE_* absents, object-storage bascule sur MinIO.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
    return !!(
        process.env.SUPABASE_URL &&
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
}

export function getSupabase(): SupabaseClient {
    if (!isSupabaseConfigured()) {
        throw new Error(
            "SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définies"
        );
    }
    if (!client) {
        client = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                },
            }
        );
    }
    return client;
}

export const SUPABASE_DOCUMENTS_BUCKET =
    process.env.SUPABASE_BUCKET_NAME || "xccm-documents";

export const SUPABASE_UPLOADS_BUCKET =
    process.env.SUPABASE_UPLOADS_BUCKET ||
    process.env.SUPABASE_BUCKET_NAME ||
    "xccm-documents";
