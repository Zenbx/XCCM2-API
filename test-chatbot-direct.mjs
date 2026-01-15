import { InferenceClient } from "@huggingface/inference";
import dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config({ path: '.env.local' });

async function testChatbot() {
    try {
        console.log('🧪 Test direct du chatbot Hugging Face...\n');

        // Vérifier le token
        if (!process.env.HF_API_TOKEN) {
            throw new Error('HF_API_TOKEN non défini dans .env.local');
        }

        console.log('✅ Token HF trouvé');

        // Créer le client (utilise l'endpoint par défaut)
        const client = new InferenceClient(process.env.HF_API_TOKEN);

        console.log('✅ Client initialisé\n');

        // Texte de test
        const testContent = "La photosynthèse est le processus par lequel les plantes convertissent la lumière solaire en énergie chimique.";

        // Construire le prompt
        const prompt = `<s>[INST] Tu es un expert en pédagogie et en vulgarisation. Tu aides à reformuler des contenus éducatifs pour les rendre clairs, précis et engageants.

Reformule le contenu dans un langage simple, accessible et concret. Utilise des phrases courtes, des exemples parlants et évite le jargon technique.

Contenu à reformuler :
\`\`\`
${testContent}
\`\`\`
[/INST]`;

        console.log('📝 Texte original:');
        console.log(testContent);
        console.log('\n⏳ Reformulation en cours...\n');

        // Appel à l'API
        const response = await client.textGeneration({
            model: "mistralai/Mistral-7B-Instruct-v0.2",
            inputs: prompt,
            parameters: {
                max_new_tokens: 512,
                temperature: 0.4,
                return_full_text: false,
            },
        });

        const result = response.generated_text?.trim() || "";

        if (!result) {
            throw new Error('Réponse vide du modèle');
        }

        console.log('✅ Reformulation réussie!\n');
        console.log('📄 Résultat:');
        console.log(result);
        console.log('\n✨ Test terminé avec succès!');
        console.log('\n🎉 Le chatbot fonctionne correctement!');
        console.log('   Le problème est uniquement la connexion MongoDB.');

    } catch (error) {
        console.error('❌ Erreur:', error.message);

        if (error.message.includes('router.huggingface.co')) {
            console.error('\n💡 Problème avec l\'endpoint Hugging Face');
        } else if (error.message.includes('HF_API_TOKEN')) {
            console.error('\n💡 Vérifiez votre token Hugging Face dans .env.local');
        } else {
            console.error('\n📋 Détails:', error);
        }

        process.exit(1);
    }
}

testChatbot();
