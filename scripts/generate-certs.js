#!/usr/bin/env node

/**
 * @fileoverview Script pour générer des certificats SSL/TLS auto-signés pour le développement local
 * Usage: node scripts/generate-certs.js
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const certsDir = path.join(__dirname, "..", "certs");

// Créer le répertoire certs s'il n'existe pas
if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir, { recursive: true });
}

const certPath = path.join(certsDir, "localhost.crt");
const keyPath = path.join(certsDir, "localhost.key");

// Si les certificats existent déjà, ne rien faire
if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    console.log("✅ Certificats SSL existants trouvés");
    process.exit(0);
}

console.log("📝 Génération des certificats SSL auto-signés...");

try {
    // Générer une clé privée et un certificat auto-signé
    const command = `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=localhost"`;

    execSync(command, { stdio: "inherit" });

    console.log("✅ Certificats généré avec succès !");
    console.log(`   📄 Certificat: ${certPath}`);
    console.log(`   🔑 Clé privée: ${keyPath}`);
    console.log("\n💡 Utilisez ces certificats pour HTTPS en développement");
} catch (error) {
    console.error("❌ Erreur lors de la génération des certificats:");
    console.error(error.message);
    console.error("\n⚠️  OpenSSL n'est pas installé.");
    console.error("Sur Windows, vous pouvez utiliser:");
    console.error("  1. WSL (Windows Subsystem for Linux)");
    console.error("  2. Git Bash (inclut OpenSSL)");
    console.error("  3. Installer OpenSSL séparément");
    process.exit(1);
}
