import swaggerJSDoc from "swagger-jsdoc";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "XCCM API Documentation",
            version: "1.0.0",
            description: `
        API REST pour la plateforme XCCM (Cross-Cultural Content Management).
        
        ## Authentification
        La plupart des endpoints nécessitent un token JWT.
        Ajoutez le header: \`Authorization: Bearer <votre_token>\`
        
        ## Fonctionnalités principales
        - Gestion des utilisateurs et authentification
        - Gestion des projets collaboratifs
        - Gestion des documents et contenus
        - Système de likes et d'invitations
      `,
            contact: {
                name: "Support XCCM",
                email: "support@xccm.com",
            },
            license: {
                name: "MIT",
                url: "https://opensource.org/licenses/MIT",
            },
        },
        servers: [
            {
                url: "http://localhost:3001",
                description: "Serveur local",
            },
            {
                url: "https://xccm-2-api.vercel.app",
                description: "Serveur Vercel (Staging)",
            },
            {
                url: "https://api.xccm.com",
                description: "Serveur de production",
            },
        ],
        tags: [
            { name: "Authentication", description: "Endpoints d'authentification et gestion de session" },
            { name: "Projects", description: "Gestion des projets collaboratifs" },
            { name: "Health", description: "Endpoints de santé de l'API" },
            { name: "Parts", description: "Gestion des parties (granules de niveau 1)" },
            { name: "Chapters", description: "Gestion des chapitres (granules de niveau 2)" },
            { name: "Paragraphs", description: "Gestion des paragraphes (granules de niveau 3)" },
            { name: "Notions", description: "Gestion des notions (granules de niveau 4)" },
            { name: "Documents", description: "Gestion des documents PDF (téléchargement, génération)" },
            { name: "Invitations", description: "Gestion des invitations de collaboration" },
        ],
        security: [{ bearerAuth: [] }],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                    description: "Entrez votre token JWT",
                },
            },
            // Note: Les schemas sont normalement dans swagger.ts, on pourrait les copier ici ou les laisser vides 
            // car ils seront extraits des JSDoc si présents. Mais pour être sûr, on en remet quelques uns.
            schemas: {
                ApiError: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: false },
                        message: { type: "string" },
                        error: { type: "string" }
                    }
                }
            }
        },
    },
    apis: ["./src/app/api/**/*.ts"],
};

try {
    console.log("🚀 Generating Swagger specification...");
    const spec = swaggerJSDoc(swaggerOptions);

    const publicDir = join(rootDir, "public");
    if (!existsSync(publicDir)) {
        mkdirSync(publicDir, { recursive: true });
    }

    writeFileSync(join(publicDir, "swagger.json"), JSON.stringify(spec, null, 2));
    console.log("✅ Swagger specification generated at public/swagger.json");
} catch (error) {
    console.error("❌ Error generating Swagger spec:", error);
    process.exit(1);
}
