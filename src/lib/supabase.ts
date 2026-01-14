/**
 * @fileoverview Client Supabase pour l'upload de documents
 * Gère la connexion et les opérations sur Supabase Storage
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
        "Les variables SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définies"
    );
}

/**
 * Client Supabase avec privilèges admin (service role)
 */
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

/**
 * Nom du bucket Supabase pour les documents
 */
export const DOCUMENTS_BUCKET = process.env.SUPABASE_BUCKET_NAME || "xccm-documents";