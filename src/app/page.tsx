/*import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            To get started, edit the page.tsx file.
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Looking for a starting point or more instructions? Head over to{" "}
            <a
              href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Templates
            </a>{" "}
            or the{" "}
            <a
              href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Learning
            </a>{" "}
            center.
          </p>
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <a
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="dark:invert"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={16}
              height={16}
            />
            Deploy Now
          </a>
          <a
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Documentation
          </a>
        </div>
      </main>
    </div>
  );
}
 */
/**
 * @fileoverview Page d'accueil de l'application
 * Affiche les informations de base et les liens vers la documentation
 */

import Link from "next/link";

/**
 * Composant de la page d'accueil
 * @returns Page d'accueil React
 */
export default function Home() {
  return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto">
            {/* En-tête */}
            <div className="text-center mb-12 animate-fade-in">
              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-4">
                Bienvenue sur <span className="text-blue-600">XCCM</span>
              </h1>
              <p className="text-xl md:text-2xl text-gray-600">
                Plateforme de gestion de contenu collaboratif
              </p>
              <p className="text-md text-gray-500 mt-2">
                API REST moderne avec Next.js 15, Prisma & MongoDB
              </p>
            </div>

            {/* Cartes de fonctionnalités */}
            <div className="grid md:grid-cols-2 gap-6 mb-12">
              <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow duration-300 border-t-4 border-blue-500">
                <div className="text-4xl mb-3">🔐</div>
                <h2 className="text-2xl font-semibold text-gray-800 mb-3">
                  Authentification Sécurisée
                </h2>
                <p className="text-gray-600 mb-4">
                  Système complet d'inscription, connexion et gestion de session
                  avec JWT.
                </p>
                <ul className="text-sm text-gray-500 space-y-2">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    Hashage bcrypt des mots de passe
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    Tokens JWT avec expiration configurable
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    Protection des routes par middleware
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    Validation stricte avec Zod
                  </li>
                </ul>
              </div>

              <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow duration-300 border-t-4 border-purple-500">
                <div className="text-4xl mb-3">📚</div>
                <h2 className="text-2xl font-semibold text-gray-800 mb-3">
                  Documentation Interactive
                </h2>
                <p className="text-gray-600 mb-4">
                  API REST complètement documentée avec Swagger/OpenAPI 3.0.
                </p>
                <Link
                    href="/docs"
                    className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md hover:shadow-lg"
                >
                  Explorer l'API →
                </Link>
                <p className="text-xs text-gray-500 mt-3">
                  Testez tous les endpoints directement depuis votre navigateur
                </p>
              </div>

              <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow duration-300 border-t-4 border-green-500">
                <div className="text-4xl mb-3">🗂️</div>
                <h2 className="text-2xl font-semibold text-gray-800 mb-3">
                  Gestion de Projets
                </h2>
                <p className="text-gray-600 mb-4">
                  Créez et gérez des projets collaboratifs avec documents et
                  structure hiérarchique.
                </p>
                <ul className="text-sm text-gray-500 space-y-2">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    Projets multi-utilisateurs
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    Documents structurés (Parts/Chapters/Paragraphs)
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    Système d'invitations collaboratives
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    Likes et statistiques de documents
                  </li>
                </ul>
              </div>

              <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow duration-300 border-t-4 border-indigo-500">
                <div className="text-4xl mb-3">💾</div>
                <h2 className="text-2xl font-semibold text-gray-800 mb-3">
                  Base de données MongoDB
                </h2>
                <p className="text-gray-600 mb-4">
                  Architecture NoSQL avec Prisma ORM pour des performances
                  optimales.
                </p>
                <ul className="text-sm text-gray-500 space-y-2">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    Modèles relationnels avec ObjectId
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    Migrations automatiques Prisma
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    Type-safety complet avec TypeScript
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    Contraintes d'unicité et relations
                  </li>
                </ul>
              </div>
            </div>

            {/* Section API Endpoints */}
            <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
              <h2 className="text-3xl font-semibold text-gray-800 mb-6 text-center">
                🚀 Endpoints API Disponibles
              </h2>

              <div className="space-y-4">
                <div className="border-l-4 border-green-500 pl-4 py-2 bg-green-50 rounded-r">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <code className="text-sm font-mono text-green-700 font-semibold">
                      POST /api/auth/register
                    </code>
                    <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded">
                    PUBLIC
                  </span>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">
                    Inscription d'un nouvel utilisateur avec validation Zod
                  </p>
                </div>

                <div className="border-l-4 border-blue-500 pl-4 py-2 bg-blue-50 rounded-r">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <code className="text-sm font-mono text-blue-700 font-semibold">
                      POST /api/auth/login
                    </code>
                    <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">
                    PUBLIC
                  </span>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">
                    Connexion et obtention du token JWT
                  </p>
                </div>

                <div className="border-l-4 border-yellow-500 pl-4 py-2 bg-yellow-50 rounded-r">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <code className="text-sm font-mono text-yellow-700 font-semibold">
                      GET /api/auth/me
                    </code>
                    <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded">
                    PROTECTED
                  </span>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">
                    Récupérer les informations de l'utilisateur connecté
                  </p>
                </div>

                <div className="border-l-4 border-red-500 pl-4 py-2 bg-red-50 rounded-r">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <code className="text-sm font-mono text-red-700 font-semibold">
                      POST /api/auth/logout
                    </code>
                    <span className="text-xs bg-red-200 text-red-800 px-2 py-1 rounded">
                    PROTECTED
                  </span>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">
                    Déconnexion de l'utilisateur (suppression du token côté client)
                  </p>
                </div>

                <div className="border-l-4 border-purple-500 pl-4 py-2 bg-purple-50 rounded-r">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <code className="text-sm font-mono text-purple-700 font-semibold">
                      GET /api/health
                    </code>
                    <span className="text-xs bg-purple-200 text-purple-800 px-2 py-1 rounded">
                    PUBLIC
                  </span>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">
                    Vérifier l'état et la disponibilité de l'API
                  </p>
                </div>
              </div>

              <div className="mt-8 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>💡 Astuce :</strong> Utilisez la documentation Swagger
                  pour tester tous les endpoints directement depuis votre
                  navigateur. Cliquez sur "Authorize" pour ajouter votre token JWT.
                </p>
              </div>
            </div>

            {/* Section Technologies */}
            <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-lg shadow-lg p-8 mb-8">
              <h3 className="text-2xl font-semibold mb-4 text-center">
                🛠️ Stack Technique
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="bg-gray-700 rounded p-3">
                  <p className="font-bold">Next.js</p>
                  <p className="text-xs text-gray-300">v15.1.4</p>
                </div>
                <div className="bg-gray-700 rounded p-3">
                  <p className="font-bold">TypeScript</p>
                  <p className="text-xs text-gray-300">Type-safe</p>
                </div>
                <div className="bg-gray-700 rounded p-3">
                  <p className="font-bold">Prisma</p>
                  <p className="text-xs text-gray-300">ORM</p>
                </div>
                <div className="bg-gray-700 rounded p-3">
                  <p className="font-bold">MongoDB</p>
                  <p className="text-xs text-gray-300">NoSQL</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center mt-12 text-gray-500 border-t pt-8">
              <p className="font-medium">
                Construit avec ❤️ en utilisant Next.js 15, Prisma, MongoDB et TypeScript
              </p>
              <p className="text-sm mt-2">
                © 2024 XCCM - Cross-Cultural Content Management Platform
              </p>
              <div className="mt-4 flex justify-center gap-4 text-sm">
                <Link href="/docs" className="text-blue-600 hover:text-blue-800 hover:underline">
                  Documentation API
                </Link>
                <span className="text-gray-300">|</span>
                <a href="#" className="text-blue-600 hover:text-blue-800 hover:underline">
                  GitHub
                </a>
                <span className="text-gray-300">|</span>
                <a href="#" className="text-blue-600 hover:text-blue-800 hover:underline">
                  Support
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
  );
}
