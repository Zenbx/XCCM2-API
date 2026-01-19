# 🚀 Déploiement Synapse - Guide Rapide

Guide ultra-rapide pour déployer le serveur WebSocket Synapse sur Railway.

## ⚡ Déploiement en 5 Minutes

### 1️⃣ Préparer les Variables (2 min)

Récupérez depuis votre backend Vercel:
- `JWT_SECRET` (Settings > Environment Variables)
- `DATABASE_URL` (votre MongoDB Atlas)

### 2️⃣ Créer le Projet Railway (1 min)

```bash
# Option A: Via l'interface Web
1. Allez sur https://railway.app/
2. New Project > Deploy from GitHub repo
3. Sélectionnez XCCM2-API

# Option B: Via CLI
railway init
railway link
```

### 3️⃣ Configurer les Variables (1 min)

Dans Railway > Variables, ajoutez:

```bash
DATABASE_URL=mongodb+srv://...
JWT_SECRET=votre-secret-identique-backend
NODE_ENV=production
```

⚠️ **NE PAS** définir `PORT` (Railway le gère automatiquement)

### 4️⃣ Déployer (1 min)

Railway déploie automatiquement. Attendez l'icône verte ✅

Récupérez votre URL: `https://votre-synapse.up.railway.app`

### 5️⃣ Mettre à Jour le Frontend (30 sec)

Dans Vercel (frontend) > Settings > Environment Variables:

```bash
NEXT_PUBLIC_HOCUSPOCUS_URL=wss://votre-synapse.up.railway.app
```

Redéployez le frontend (Deployments > ... > Redeploy)

---

## ✅ Test Rapide

```bash
# Installer wscat
npm install -g wscat

# Tester
wscat -c wss://votre-synapse.up.railway.app
# Erreur d'auth attendue = ✅ Serveur fonctionne!
```

---

## 📁 Fichiers Créés

Tous les fichiers nécessaires sont déjà prêts:

```
XCCM2-API/
├── Dockerfile.synapse          ✅ Build optimisé
├── railway.json                ✅ Config Railway
├── .env.example.synapse        ✅ Template env
├── .dockerignore               ✅ Optimisation build
└── src/synapse/server.ts       ✅ Serveur (déjà corrigé)
```

---

## 🔧 Commandes Utiles

```bash
# Vérifier l'environnement local
npm run synapse:check

# Lancer localement avec vérification
npm run synapse:dev

# Lancer localement sans vérification
npm run synapse

# Voir les logs Railway (avec CLI)
railway logs
```

---

## 🆘 Problèmes Courants

### ❌ "Authentication requise" dans les logs
→ Frontend n'envoie pas le token. Vérifiez l'intégration WebSocket.

### ❌ Build failed
→ Vérifiez que `Dockerfile.synapse` et `railway.json` existent.

### ❌ Connection closed immédiatement
→ Vérifiez `DATABASE_URL` dans Railway.

### ❌ JWT_SECRET invalide
→ Doit être **exactement identique** au backend.

---

## 📚 Documentation Complète

Pour plus de détails, consultez [README-SYNAPSE-DEPLOY.md](README-SYNAPSE-DEPLOY.md)

---

## ✅ Checklist Finale

- [ ] Variables configurées sur Railway
- [ ] Déploiement Railway réussi (icône verte)
- [ ] URL WebSocket récupérée
- [ ] Frontend mis à jour avec la nouvelle URL
- [ ] Frontend redéployé
- [ ] Test wscat réussi

---

**C'est tout!** Votre serveur Synapse est opérationnel! 🎉

Architecture:
```
Frontend (Vercel) ──┐
                    ├──> MongoDB (Atlas)
Backend (Vercel) ───┤
                    │
Synapse (Railway) ──┘
```
