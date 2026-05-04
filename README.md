# XCCM2-API

API REST de la plateforme XCCM 2, construite avec Next.js 15, Prisma et MongoDB. Elle expose ~80 routes couvrant l'authentification, la gestion des cours, le LMS, la marketplace et l'IA.

## Table des matières

- [Stack technique](#stack-technique)
- [Installation](#installation)
- [Variables d'environnement](#variables-denvironnement)
- [Structure du projet](#structure-du-projet)
- [Routes API](#routes-api)
- [Authentification](#authentification)
- [Sécurité](#sécurité)
- [Tests](#tests)
- [Documentation interactive](#documentation-interactive)
- [Serveur Synapse](#serveur-synapse)
- [Déploiement](#déploiement)

---

## Stack technique

| Outil | Rôle |
|---|---|
| Next.js 15 (App Router) | Framework API |
| Prisma | ORM MongoDB |
| MongoDB Atlas | Base de données |
| Upstash Redis | Cache projets + rate-limiting |
| `jose` (JWT) | Authentification stateless |
| `bcryptjs` | Hashage des mots de passe |
| Zod | Validation des entrées |
| Cloudinary | Stockage fichiers |
| Vitest | Tests unitaires (90 tests) |

---

## Installation

```bash
# Cloner et accéder au dossier
git clone <repo-url> && cd IHM/XCCM2-API

# Installer les dépendances
npm install --legacy-peer-deps

# Configurer l'environnement
cp .env.example .env
# Éditer .env avec vos vraies valeurs (voir section ci-dessous)

# Générer le client Prisma
npx prisma generate

# Lancer en développement (port 3001)
npm run dev
```

---

## Variables d'environnement

Copiez `.env.example` en `.env`. Variables obligatoires :

| Variable | Description | Où l'obtenir |
|---|---|---|
| `DATABASE_URL` | URL MongoDB Atlas | [cloud.mongodb.com](https://cloud.mongodb.com) |
| `JWT_SECRET` | Secret ≥ 32 caractères | `node -e "require('crypto').randomBytes(32).toString('hex')"` |
| `JWT_EXPIRES_IN` | Durée du token (ex: `7d`) | — |
| `UPSTASH_REDIS_REST_URL` | URL REST Redis | [upstash.com](https://upstash.com) |
| `UPSTASH_REDIS_REST_TOKEN` | Token REST Redis | [upstash.com](https://upstash.com) |
| `CLOUDINARY_CLOUD_NAME` | Nom du cloud | [cloudinary.com](https://cloudinary.com) |
| `CLOUDINARY_API_KEY` | Clé API Cloudinary | [cloudinary.com](https://cloudinary.com) |
| `CLOUDINARY_API_SECRET` | Secret Cloudinary | [cloudinary.com](https://cloudinary.com) |

Variables optionnelles (IA, OAuth, email) : voir [`.env.example`](./.env.example).

---

## Structure du projet

```
XCCM2-API/
├── src/
│   ├── app/
│   │   └── api/                  # Routes API
│   │       ├── auth/             # Login, register, logout, refresh, me
│   │       ├── projects/         # CRUD projets + structure hiérarchique
│   │       ├── classrooms/       # Classes (LMS)
│   │       ├── exercises/        # Exercices & soumissions
│   │       ├── marketplace/      # Marketplace de contenus
│   │       ├── vault/            # Coffre-fort utilisateur
│   │       ├── ai/               # Routes IA (éditeur, socratique, audit)
│   │       ├── documents/        # Documents PDF
│   │       ├── upload/           # Upload Cloudinary
│   │       ├── admin/            # Routes admin
│   │       ├── health/           # Healthcheck
│   │       └── docs/             # Spec OpenAPI
│   ├── lib/
│   │   ├── auth.ts               # hashPassword, generateToken, verifyToken
│   │   ├── prisma.ts             # Client Prisma singleton
│   │   ├── redis.ts              # Client Upstash Redis
│   │   ├── rateLimit.ts          # Rate-limiting par IP (fail-open)
│   │   ├── tokenBlacklist.ts     # Blacklist JWT (logout)
│   │   └── env-check.ts          # Vérification variables au démarrage
│   ├── services/
│   │   └── cache-service.ts      # Wrapper Redis (get/set/del)
│   ├── middleware.ts             # CORS, JWT, sécurité HTTP, blacklist
│   ├── utils/
│   │   ├── api-response.ts       # Helpers successResponse, errorResponse…
│   │   └── validation.ts         # Schémas Zod
│   └── synapse/
│       └── server.ts             # Serveur WebSocket Hocuspocus
├── prisma/
│   └── schema.prisma             # Schéma MongoDB
├── src/test/                     # 90 tests Vitest
├── .env.example
├── vitest.config.ts
└── package.json
```

---

## Routes API

### Authentification

| Méthode | Route | Description | Auth |
|---|---|---|---|
| POST | `/api/auth/register` | Inscription | Publique |
| POST | `/api/auth/login` | Connexion → JWT | Publique |
| GET | `/api/auth/me` | Profil courant | JWT |
| POST | `/api/auth/logout` | Révocation du token | JWT |
| POST | `/api/auth/refresh` | Renouvellement token (<24h restantes) | JWT |
| POST | `/api/auth/forgot-password` | Envoi email reset | Publique |
| POST | `/api/auth/reset-password` | Réinitialisation mot de passe | Publique |

### Projets & structure hiérarchique

| Méthode | Route | Description |
|---|---|---|
| GET / POST | `/api/projects` | Liste + création |
| GET / PUT / DELETE | `/api/projects/[pr_name]` | Détail / mise à jour / suppression |
| GET / POST | `/api/projects/[pr_name]/parts` | Parties |
| GET / POST | `…/parts/[part_title]/chapters` | Chapitres |
| GET / POST | `…/chapters/[chapter_title]/paragraphs` | Paragraphes |
| GET / POST | `…/paragraphs/[para_name]/notions` | Notions |
| POST | `/api/projects/[pr_name]/invitations/email` | Inviter un collaborateur |
| GET / POST | `/api/projects/[pr_name]/revisions` | Historique de révisions |
| GET | `/api/projects/[pr_name]/structure` | Arbre complet (cache Redis) |
| POST | `/api/projects/[pr_name]/publish` | Publication |
| POST | `/api/projects/[pr_name]/export` | Export PDF/JSON |

### LMS — Classes

| Méthode | Route | Description |
|---|---|---|
| GET / POST | `/api/classrooms` | Mes classes (teaching + enrolled) |
| GET / PUT / DELETE | `/api/classrooms/[classId]` | Détail |
| POST | `/api/enrollments` | Rejoindre une classe (join_code) |
| GET / POST | `/api/classrooms/[classId]/assignments` | Devoirs |
| POST | `/api/classrooms/[classId]/assignments/[id]/submit` | Rendu |
| GET / POST | `/api/exercises` | Exercices (QCU, QCM, QRO, CODE…) |

### IA

| Méthode | Route | Description | Modèle |
|---|---|---|---|
| POST | `/api/ai/editor` | Assistant éditeur (outils structurés) | Mistral |
| POST | `/api/ai/socratic` | Dialogue socratique | Hugging Face |
| POST | `/api/ai/audit` | Audit pédagogique | Claude / Gemini |
| POST | `/api/ai/analyze-pedagogical` | Analyse de contenu | Claude / Gemini |

### Autres

| Groupe | Routes |
|---|---|
| Documents | `/api/documents`, `/api/documents/[id]/download`, `/api/documents/[id]/like` |
| Upload | `/api/upload` (Cloudinary, MIME + magic bytes + rate-limit) |
| Marketplace | `/api/marketplace`, `/api/marketplace/[itemId]` |
| Vault | `/api/vault`, `/api/vault/[vaultItemId]` |
| Communauté | `/api/community/feed`, `/api/creators/top` |
| Admin | `/api/admin/projects`, `/api/admin/stats`, `/api/admin/settings` |
| Utilitaires | `/api/health`, `/api/docs` |

---

## Authentification

L'API utilise des tokens **JWT signés avec `jose`** (algorithme HS256).

```
Authorization: Bearer <token>
```

**Cycle de vie d'un token :**
1. `POST /api/auth/login` → reçoit `{ token, user }`
2. Toutes les requêtes protégées → header `Authorization: Bearer <token>`
3. `POST /api/auth/refresh` → nouveau token si expiry < 24h
4. `POST /api/auth/logout` → token ajouté à la **blacklist Redis** (TTL = durée restante)

Le middleware vérifie JWT + blacklist sur chaque requête protégée.

---

## Sécurité

| Mécanisme | Implémentation |
|---|---|
| Hashage mots de passe | bcrypt (10 rounds) |
| JWT | jose HS256, expiration configurable |
| Blacklist logout | Redis avec TTL égal à l'expiration du token |
| Rate-limiting | 5 tentatives/15 min (login), 3/h (register), 20/h (upload) |
| CORS | Whitelist stricte via `ALLOWED_ORIGINS` |
| Headers de sécurité | HSTS, X-Frame-Options DENY, CSP sans unsafe-inline, nosniff |
| Validation | Zod sur tous les corps de requête |
| Upload | Vérification MIME + magic bytes (JPEG/PNG/WEBP/PDF) |

---

## Tests

```bash
npm test                    # 90 tests, vitest run
npm run test:watch          # Mode watch
npm run test:coverage       # Couverture (v8)
```

**Couverture :**
- `src/lib/` — auth, rateLimit, tokenBlacklist, env-check
- `src/utils/` — api-response
- `src/app/api/` — auth (login/register/logout/refresh), projects, classrooms, upload, ai/editor
- `src/middleware.ts` — CORS, JWT, blacklist, headers de sécurité

---

## Documentation interactive

La spécification OpenAPI 3.0 est disponible à :

- **JSON brut :** `GET /api/docs`
- **Swagger UI :** `GET /docs` (en développement)

L'interface Swagger permet de tester tous les endpoints directement depuis le navigateur, avec authentification JWT intégrée.

---

## Serveur Synapse

Synapse est le serveur WebSocket de collaboration temps réel (Hocuspocus + Yjs CRDT). Il tourne en processus Node.js séparé et ne peut pas être une route Next.js.

```bash
# Développement local
npm run synapse              # ws://localhost:1234

# Production
# Déployé sur Railway — voir README-SYNAPSE-DEPLOY.md
```

---

## Déploiement

### Backend API → Vercel

```bash
# Variables d'environnement à configurer sur Vercel :
# DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN,
# UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN,
# CLOUDINARY_*, ALLOWED_ORIGINS, ...
vercel --prod
```

### Synapse → Railway

Voir le guide complet : [README-SYNAPSE-DEPLOY.md](./README-SYNAPSE-DEPLOY.md)

---

## Scripts disponibles

| Commande | Description |
|---|---|
| `npm run dev` | Serveur de développement (port 3001) |
| `npm run build` | Build production |
| `npm start` | Serveur production |
| `npm test` | Tests Vitest |
| `npm run test:coverage` | Tests + couverture |
| `npm run synapse` | Serveur WebSocket Hocuspocus |
| `npx prisma generate` | Régénérer le client Prisma |
| `npx prisma studio` | Interface GUI base de données |
