/**
 * Script de vérification des variables d'environnement Synapse
 * À exécuter avant le déploiement pour s'assurer que tout est configuré
 *
 * Usage: node scripts/check-synapse-env.js
 */

require('dotenv').config();

const REQUIRED_VARS = [
    'DATABASE_URL',
    'JWT_SECRET',
    'NODE_ENV'
];

const OPTIONAL_VARS = [
    'PORT',
    'SYNAPSE_PORT',
    'LOG_LEVEL'
];

console.log('🔍 Vérification des variables d\'environnement Synapse...\n');

let allValid = true;
let warnings = 0;

// Vérifier les variables requises
console.log('📋 Variables REQUISES:');
REQUIRED_VARS.forEach(varName => {
    const value = process.env[varName];
    if (!value) {
        console.log(`  ❌ ${varName}: MANQUANT`);
        allValid = false;
    } else {
        // Masquer les secrets
        const displayValue = ['JWT_SECRET', 'DATABASE_URL'].includes(varName)
            ? `${value.substring(0, 10)}...`
            : value;
        console.log(`  ✅ ${varName}: ${displayValue}`);
    }
});

console.log('\n📋 Variables OPTIONNELLES:');
OPTIONAL_VARS.forEach(varName => {
    const value = process.env[varName];
    if (value) {
        console.log(`  ✅ ${varName}: ${value}`);
    } else {
        console.log(`  ⚠️  ${varName}: non défini (optionnel)`);
    }
});

// Validations spécifiques
console.log('\n🔐 Validations de Sécurité:');

// Vérifier la longueur du JWT_SECRET
const jwtSecret = process.env.JWT_SECRET;
if (jwtSecret) {
    if (jwtSecret.length < 32) {
        console.log(`  ⚠️  JWT_SECRET trop court (${jwtSecret.length} caractères, minimum 32 recommandé)`);
        warnings++;
    } else {
        console.log(`  ✅ JWT_SECRET a une longueur sécurisée (${jwtSecret.length} caractères)`);
    }
}

// Vérifier le format de DATABASE_URL
const dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
    if (dbUrl.startsWith('mongodb://') || dbUrl.startsWith('mongodb+srv://')) {
        console.log('  ✅ DATABASE_URL a un format MongoDB valide');
    } else {
        console.log('  ❌ DATABASE_URL ne semble pas être une URL MongoDB valide');
        allValid = false;
    }
}

// Vérifier NODE_ENV
const nodeEnv = process.env.NODE_ENV;
if (nodeEnv) {
    if (['production', 'development'].includes(nodeEnv)) {
        console.log(`  ✅ NODE_ENV est valide: ${nodeEnv}`);
    } else {
        console.log(`  ⚠️  NODE_ENV a une valeur inhabituelle: ${nodeEnv}`);
        warnings++;
    }
}

// Résumé
console.log('\n' + '='.repeat(60));
if (allValid) {
    console.log('✅ SUCCÈS: Toutes les variables requises sont configurées!');
    if (warnings > 0) {
        console.log(`⚠️  ${warnings} avertissement(s) détecté(s) (vérifiez ci-dessus)`);
    }
    console.log('\n🚀 Vous pouvez déployer le serveur Synapse sur Railway!');
    process.exit(0);
} else {
    console.log('❌ ÉCHEC: Certaines variables requises sont manquantes!');
    console.log('\n📝 Pour corriger:');
    console.log('   1. Copiez .env.example.synapse vers .env');
    console.log('   2. Remplissez toutes les variables REQUISES');
    console.log('   3. Relancez ce script: node scripts/check-synapse-env.js');
    process.exit(1);
}
