/**
 * JWT helpers compatibles Edge (middleware) — sans bcrypt ni ioredis.
 */

import { jwtVerify } from "jose";
import type { JWTPayload } from "@/types/auth.types";

function getSecretKey(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error(
            "JWT_SECRET n'est pas défini dans les variables d'environnement."
        );
    }
    return new TextEncoder().encode(secret);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
    try {
        const { payload } = await jwtVerify(token, getSecretKey(), {
            algorithms: ["HS256"],
        });
        return payload as JWTPayload;
    } catch {
        return null;
    }
}

export function extractTokenFromHeader(authHeader: string | null): string | null {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return null;
    }
    return authHeader.substring(7);
}
