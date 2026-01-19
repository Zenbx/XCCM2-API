# 🛰️ Déploiement du Serveur Synapse (WebSocket Hocuspocus)

Ce guide vous accompagne dans le déploiement du serveur WebSocket Synapse sur Railway, séparé du backend API principal.

## 📋 Table des Matières

1. [Prérequis](#prérequis)
2. [Pourquoi Déployer Séparément?](#pourquoi-déployer-séparément)
3. [Architecture Finale](#architecture-finale)
4. [Configuration des Variables d'Environnement](#configuration-des-variables-denvironnement)
5. [Déploiement sur Railway](#déploiement-sur-railway)
6. [Tester le Déploiement](#tester-le-déploiement)
7. [Mettre à Jour le Frontend](#mettre-à-jour-le-frontend)
8. [Dépannage](#dépannage)

---

## Prérequis

Avant de commencer, assurez-vous d'avoir:

- ✅ Un compte [Railway](https://railway.app/) (gratuit pour commencer)
- ✅ MongoDB Atlas configuré et accessible
- ✅ Le même `JWT_SECRET` que votre backend API
- ✅ Git installé localement
- ✅ Le dépôt GitHub de votre projet

---

## Pourquoi Déployer Séparément?

Le serveur Synapse est un **serveur WebSocket standalone** qui nécessite:

- ✅ **Connexions persistantes longue durée** (WebSocket)
- ✅ **Processus Node.js dédié** (ne peut pas être une API route Next.js)
- ✅ **Pas de timeout** sur les connexions
- ✅ **Gestion de la synchronisation en temps réel** avec Y.js CRDT

**Architecture recommandée:**
- Backend API (REST) → Vercel
- Frontend (Next.js) → Vercel
- Synapse (WebSocket) → **Railway** ⭐

Railway est idéal car il:
- Gère les WebSocket persistantes
- Fournit une URL fixe pour les connexions
- Offre un plan gratuit suffisant pour démarrer
- Auto-déploie depuis GitHub

---

## Architecture Finale

```
┌─────────────────────────────────┐
│   Utilisateurs (Navigateurs)    │
└────────────┬────────────────────┘
             │
      ┌──────┴──────┐
      │             │
      ▼             ▼
┌──────────┐  ┌──────────────┐
│ Frontend │  │   Backend    │
│ (Vercel) │  │   (Vercel)   │
│ Next.js  │  │   Next.js    │
└────┬─────┘  └──────┬───────┘
     │               │
     │               │
     │      ┌────────┴────────┐
     │      │                 │
     ▼      ▼                 ▼
┌────────────────┐    ┌──────────────┐
│ Synapse Server │───▶│   MongoDB    │
│   (Railway)    │    │    Atlas     │
│   WebSocket    │    │              │
└────────────────┘    └──────────────┘
```

---

## Configuration des Variables d'Environnement

### Variables Requises pour Synapse

Copiez [.env.example.synapse](.env.example.synapse) et configurez ces variables:

```bash
# 🗄️ Base de Données - DOIT être la même que le backend
DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/xccm2"

# 🔐 JWT Secret - DOIT être identique au backend
JWT_SECRET="votre-secret-jwt-identique-au-backend"

# 🌍 Environnement
NODE_ENV=production

# 🔌 Port (Railway le gère automatiquement)
PORT=1234
```

**⚠️ IMPORTANT:** Le `JWT_SECRET` **DOIT** être **exactement le même** que celui utilisé par votre backend API, sinon l'authentification échouera.

### Comment Obtenir le JWT_SECRET du Backend?

Sur Vercel (backend):
1. Allez dans votre projet backend → Settings → Environment Variables
2. Copiez la valeur de `JWT_SECRET`
3. Utilisez cette même valeur pour Railway

---

## Déploiement sur Railway

### Étape 1: Créer un Nouveau Projet Railway

1. Allez sur [Railway](https://railway.app/)
2. Connectez-vous avec GitHub
3. Cliquez sur **"New Project"**
4. Sélectionnez **"Deploy from GitHub repo"**
5. Choisissez votre dépôt `XCCM2-API`

### Étape 2: Configurer le Build

Railway détectera automatiquement le `railway.json` qui configure:
- Le Dockerfile à utiliser: `Dockerfile.synapse`
- Le nombre de répliques: 1
- La politique de redémarrage

Si vous devez configurer manuellement:

1. **Settings** → **Build**
   - Builder: `Dockerfile`
   - Dockerfile Path: `Dockerfile.synapse`

2. **Settings** → **Deploy**
   - Start Command: `tsx src/synapse/server.ts` (déjà dans le Dockerfile)

### Étape 3: Configurer les Variables d'Environnement

Dans Railway, allez dans **Variables** et ajoutez:

```bash
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/xccm2
JWT_SECRET=votre-secret-identique-au-backend
NODE_ENV=production
```

**Ne pas définir `PORT`** - Railway le gère automatiquement.

### Étape 4: Déployer

1. Railway va automatiquement builder et déployer
2. Attendez que le build soit terminé (icône verte)
3. Railway vous fournira une URL: `https://votre-synapse.up.railway.app`

### Étape 5: Obtenir l'URL WebSocket

1. Dans Railway, cliquez sur votre service Synapse
2. Allez dans **Settings** → **Networking**
3. Notez l'URL publique (ex: `votre-synapse.up.railway.app`)
4. L'URL WebSocket sera: `wss://votre-synapse.up.railway.app`

---

## Tester le Déploiement

### Test 1: Vérifier que le Serveur Répond

Installez `wscat` pour tester les WebSocket:

```bash
npm install -g wscat
```

Testez la connexion:

```bash
wscat -c wss://votre-synapse.up.railway.app
```

Vous devriez voir un message d'erreur d'authentification (normal, pas de token):
```
Error: Authentication requise
```

Cela signifie que le serveur fonctionne! ✅

### Test 2: Vérifier les Logs Railway

Dans Railway:
1. Cliquez sur votre service Synapse
2. Allez dans **Deployments** → Sélectionnez le dernier déploiement
3. Cliquez sur **View Logs**

Vous devriez voir:
```
[Synapse] 🛰️ Collaboration server running on ws://0.0.0.0:XXXX
```

---

## Mettre à Jour le Frontend

Une fois Synapse déployé sur Railway, vous devez mettre à jour votre frontend pour utiliser la nouvelle URL WebSocket.

### Dans le Frontend (Vercel)

1. Allez dans votre projet frontend sur Vercel
2. **Settings** → **Environment Variables**
3. Modifiez `NEXT_PUBLIC_HOCUSPOCUS_URL`:

```bash
NEXT_PUBLIC_HOCUSPOCUS_URL=wss://votre-synapse.up.railway.app
```

4. **Redéployez** le frontend pour appliquer les changements:
   - Allez dans **Deployments**
   - Cliquez sur les trois points "..." du dernier déploiement
   - Sélectionnez **Redeploy**

### En Local (Développement)

Dans `front-xccm2/.env.local`:

```bash
# En production
NEXT_PUBLIC_HOCUSPOCUS_URL=wss://votre-synapse.up.railway.app

# OU en développement local
NEXT_PUBLIC_HOCUSPOCUS_URL=ws://localhost:1234
```

---

## Configuration CORS Backend

Assurez-vous que votre backend API autorise les requêtes depuis Railway.

Dans `XCCM2-API/.env` (Vercel):

```bash
ALLOWED_ORIGINS="https://votre-frontend.vercel.app,https://votre-backend.vercel.app"
```

**Note:** Synapse n'a pas besoin d'être dans ALLOWED_ORIGINS car il ne fait pas de requêtes HTTP CORS, uniquement WebSocket.

---

## Dépannage

### Problème 1: "Authentication requise"

**Symptôme:** Les utilisateurs ne peuvent pas se connecter au WebSocket

**Solution:**
1. Vérifiez que `JWT_SECRET` est identique entre backend et Synapse
2. Vérifiez que le frontend envoie bien le token dans la connexion WebSocket
3. Consultez les logs Railway pour voir les erreurs d'authentification

```bash
# Dans Railway Logs, cherchez:
[Synapse] ❌ Connexion refusée: pas de token
[Synapse] ❌ Erreur d'authentification: ...
```

### Problème 2: "Connection closed" immédiatement

**Symptôme:** La connexion WebSocket se ferme aussitôt après ouverture

**Solution:**
1. Vérifiez que `DATABASE_URL` est correcte et accessible depuis Railway
2. Testez la connexion MongoDB depuis Railway:

```bash
# Dans Railway, ajoutez temporairement une variable:
DEBUG=prisma:*
# Redéployez et consultez les logs
```

### Problème 3: Build Failed sur Railway

**Symptôme:** Le build échoue avec des erreurs TypeScript

**Solution:**
1. Vérifiez que `Dockerfile.synapse` est bien présent
2. Vérifiez que `railway.json` pointe vers le bon Dockerfile
3. Consultez les logs de build Railway pour identifier l'erreur exacte

### Problème 4: Pas de Port Disponible

**Symptôme:** `Error: listen EADDRINUSE`

**Solution:**
Railway gère le port automatiquement. Assurez-vous de:
1. **NE PAS** définir la variable `PORT` dans Railway
2. Le code utilise `process.env.PORT` (déjà configuré dans `server.ts`)

### Problème 5: Connexion Fonctionne en Local, Pas en Production

**Vérifications:**
1. **Frontend utilise `wss://` (pas `ws://`)** pour la production
2. **URL est correcte** dans `NEXT_PUBLIC_HOCUSPOCUS_URL`
3. **Railway service est en ligne** (icône verte dans Railway)
4. **Pas de firewall** bloquant les WebSocket

---

## Commandes Utiles

### Tester Localement

```bash
# Dans XCCM2-API
npm run synapse
```

### Voir les Logs Railway en Temps Réel

```bash
# Installer Railway CLI
npm install -g @railway/cli

# Se connecter
railway login

# Lier le projet
railway link

# Voir les logs
railway logs
```

### Redéployer Manuellement

Sur Railway:
1. Allez dans **Deployments**
2. Cliquez sur **Deploy** (bouton violet)

---

## Architecture des Fichiers de Déploiement

Voici les fichiers créés pour le déploiement Synapse:

```
XCCM2-API/
├── Dockerfile.synapse           # Build optimisé pour Railway
├── railway.json                 # Configuration Railway
├── .env.example.synapse         # Template variables d'environnement
├── README-SYNAPSE-DEPLOY.md     # Ce fichier
└── src/
    └── synapse/
        └── server.ts            # Serveur WebSocket
```

---

## Résumé: Checklist de Déploiement

- [ ] MongoDB Atlas configuré et accessible
- [ ] `JWT_SECRET` récupéré depuis le backend Vercel
- [ ] Projet Railway créé et lié au dépôt GitHub
- [ ] Variables d'environnement configurées sur Railway:
  - [ ] `DATABASE_URL`
  - [ ] `JWT_SECRET` (identique au backend)
  - [ ] `NODE_ENV=production`
- [ ] Build Railway réussi (icône verte)
- [ ] URL WebSocket récupérée: `wss://votre-synapse.up.railway.app`
- [ ] Frontend mis à jour avec `NEXT_PUBLIC_HOCUSPOCUS_URL`
- [ ] Frontend redéployé sur Vercel
- [ ] Test de connexion WebSocket réussi avec `wscat`
- [ ] Logs Railway montrent: "Collaboration server running"

---

## Support

Si vous rencontrez des problèmes:

1. **Consultez les logs Railway** pour identifier les erreurs
2. **Vérifiez que toutes les variables d'environnement sont correctes**
3. **Testez la connexion MongoDB** depuis Railway
4. **Vérifiez que `JWT_SECRET` est identique** entre backend et Synapse

---

## 🎉 Déploiement Réussi!

Une fois tous les checks validés, votre serveur Synapse est opérationnel et les utilisateurs peuvent collaborer en temps réel sur vos documents!

**Architecture Finale:**
- ✅ Backend API → Vercel
- ✅ Frontend → Vercel
- ✅ Synapse WebSocket → Railway ⭐
- ✅ MongoDB → Atlas

Bonne collaboration! 🚀
