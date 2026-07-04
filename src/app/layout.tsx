/**
 * @fileoverview Layout principal de l'application Next.js
 * Poppins via @fontsource (build offline, sans Google Fonts).
 */

import type { Metadata } from "next";
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-500.css";
import "@fontsource/poppins/latin-600.css";
import "@fontsource/poppins/latin-700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "XCCM - eXtended Content Composition Module",
  description: "Plateforme de gestion de contenu collaboratif avec authentification sécurisée",
  keywords: ["XCCM", "content management", "collaboration", "documents", "API REST"],
  authors: [{ name: "XCCM Team" }],
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="font-poppins antialiased">{children}</body>
    </html>
  );
}
