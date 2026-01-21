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
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'none',
        path: '/',
        secure: true
      }
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: {
        sameSite: 'none',
        path: '/',
        secure: true
      }
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        sameSite: 'none',
        path: '/',
        secure: true
      }
    }
  },
  jwt: {
    secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || "fallback-secret",
  },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.sub = user.id || user.email || undefined;
      }

      // On ne modifie pas les noms ici, on laisse le bridge gérer la logique métier
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub || "";
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      // Autoriser tous les logins OAuth à passer vers le Bridge
      // Le Bridge décidera si on crée le compte ou si on bloque selon le mode (login/register)
      if (account?.provider === 'google' || account?.provider === 'azure-ad') {
        return true;
      }

      return !!user;
    },
  },
};

