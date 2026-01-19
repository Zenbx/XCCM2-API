import type { NextAuthOptions, DefaultSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id?: string;
    };
  }
}

// Validation des secrets requis
if (!process.env.NEXTAUTH_SECRET) {
  throw new Error(
    "NEXTAUTH_SECRET n'est pas défini. Configurez votre fichier .env."
  );
}

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn(
    "⚠️ OAuth Google non configuré. Les variables GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET sont manquantes."
  );
}

if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
  console.warn(
    "⚠️ OAuth Microsoft non configuré. Les variables MICROSOFT_CLIENT_ID et MICROSOFT_CLIENT_SECRET sont manquantes."
  );
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile",
        },
      },
    }),
    AzureADProvider({
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      tenantId: "common",
      // SÉCURITÉ: allowDangerousEmailAccountLinking retiré
      // Cette option permettait l'account takeover et a été supprimée
      authorization: {
        params: {
          prompt: "select_account", // Force le sélecteur de compte Microsoft
          scope: "openid email profile",
        },
      },
    }),
  ].filter(provider => {
    // Filtrer les providers dont les credentials ne sont pas configurés
    const config = provider.options as { clientId?: string };
    return config.clientId !== undefined;
  }),
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  jwt: {
    secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || "fallback-secret",
  },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.sub = user.id || user.email || undefined;
      }

      if (profile?.name) {
        const nameParts = (profile.name as string).split(" ");
        token.given_name = nameParts[0];
        token.family_name = nameParts.slice(1).join(" ");
      }

      // Si c'est une première connexion OAuth, récupérer l'utilisateur depuis la BD
      if (account && account.provider && !user) {
        try {
          const prisma = require("./prisma").default;
          const dbUser = await prisma.user.findUnique({
            where: { email: token.email || "" },
          });
          if (dbUser) {
            token.sub = dbUser.user_id || token.sub;
          }
        } catch (err) {
          // Silently fail - token will use fallback
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub || "";
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      // Créer l'utilisateur en base SANS bloquer OAuth
      if (profile && user?.email) {
        try {
          const prisma = require("./prisma").default;

          const nameParts = (profile.name as string)?.split(" ") || ["", ""];
          const firstName = nameParts[0] || (profile as any)?.given_name || "";
          const lastName = nameParts.slice(1).join(" ") || (profile as any)?.family_name || "";

          await prisma.user.upsert({
            where: { email: user.email },
            update: {
              firstname: firstName,
              lastname: lastName,
            },
            create: {
              email: user.email,
              firstname: firstName,
              lastname: lastName,
            },
          });

          return true;
        } catch (error) {
          // NE JAMAIS BLOQUER OAUTH - juste log l'erreur
          console.error("[OAuth SignIn] DB error:", error);
          return true;
        }
      }

      return false;
    },
  },
};

