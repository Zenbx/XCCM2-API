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
            version: "2.1.0",
            description: `
API REST pour la plateforme XCCM 2 (Cross-Cultural Content Management).

## Authentification
La plupart des endpoints nécessitent un token JWT.
Ajoutez le header: \`Authorization: Bearer <votre_token>\`

## Fonctionnalités principales
- Authentification JWT (login, register, refresh, logout)
- Gestion des projets collaboratifs avec structure hiérarchique
- LMS intégré : classes, devoirs, exercices
- Marketplace de contenus pédagogiques
- IA intégrée (Mistral, Claude, Gemini)
- Collaboration temps réel (Yjs CRDT via Hocuspocus)
      `,
            contact: { name: "Support XCCM", email: "support@xccm.com" },
            license: { name: "MIT", url: "https://opensource.org/licenses/MIT" },
        },
        servers: [
            { url: "http://localhost:3001", description: "Serveur local" },
            { url: "https://xccm-2-api.vercel.app", description: "Production Vercel" },
        ],
        tags: [
            { name: "Authentication", description: "Authentification et gestion de session" },
            { name: "Projects", description: "Gestion des projets collaboratifs" },
            { name: "Parts", description: "Parties (granules niveau 1)" },
            { name: "Chapters", description: "Chapitres (granules niveau 2)" },
            { name: "Paragraphs", description: "Paragraphes (granules niveau 3)" },
            { name: "Notions", description: "Notions (granules niveau 4)" },
            { name: "Documents", description: "Documents PDF" },
            { name: "Invitations", description: "Invitations de collaboration" },
            { name: "Classrooms", description: "Classes et LMS" },
            { name: "Exercises", description: "Exercices et soumissions" },
            { name: "Marketplace", description: "Marché de contenus pédagogiques" },
            { name: "Vault", description: "Coffre-fort personnel" },
            { name: "AI", description: "Intelligence artificielle" },
            { name: "Community", description: "Fonctionnalités sociales" },
            { name: "Users", description: "Profils et gestion utilisateurs (admin)" },
            { name: "User", description: "Compte personnel (paramètres, stats)" },
            { name: "Upload", description: "Upload de fichiers Cloudinary" },
            { name: "Notifications", description: "Notifications in-app" },
            { name: "Realtime", description: "Authentification temps réel (Ably)" },
            { name: "Health", description: "Santé de l'API" },
        ],
        security: [{ bearerAuth: [] }],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                    description: "Token JWT obtenu via POST /api/auth/login",
                },
            },
            schemas: {
                User: {
                    type: "object",
                    properties: {
                        user_id: { type: "string", description: "ID MongoDB" },
                        email: { type: "string", format: "email" },
                        lastname: { type: "string" },
                        firstname: { type: "string" },
                        org: { type: "string", nullable: true },
                        occupation: { type: "string", nullable: true },
                    },
                },
                ApiSuccess: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        message: { type: "string" },
                        data: { type: "object" },
                    },
                },
                ApiError: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: false },
                        message: { type: "string" },
                        error: { type: "string" },
                        errors: { type: "object", additionalProperties: { type: "array", items: { type: "string" } } },
                    },
                },
                Project: {
                    type: "object",
                    properties: {
                        pr_id: { type: "string" },
                        pr_name: { type: "string" },
                        owner_id: { type: "string" },
                        created_at: { type: "string", format: "date-time" },
                        updated_at: { type: "string", format: "date-time" },
                    },
                },
                Part: {
                    type: "object",
                    properties: {
                        part_id: { type: "string" },
                        part_title: { type: "string" },
                        part_intro: { type: "string", nullable: true },
                        part_number: { type: "integer" },
                        parent_pr: { type: "string" },
                    },
                },
                Chapter: {
                    type: "object",
                    properties: {
                        chapter_id: { type: "string" },
                        chapter_title: { type: "string" },
                        chapter_number: { type: "integer" },
                        parent_part: { type: "string" },
                    },
                },
                Paragraph: {
                    type: "object",
                    properties: {
                        para_id: { type: "string" },
                        para_name: { type: "string" },
                        para_number: { type: "integer" },
                        parent_chapter: { type: "string" },
                    },
                },
                Notion: {
                    type: "object",
                    properties: {
                        notion_id: { type: "string" },
                        notion_name: { type: "string" },
                        notion_content: { type: "string" },
                        parent_para: { type: "string" },
                    },
                },
                Document: {
                    type: "object",
                    properties: {
                        document_id: { type: "string" },
                        name: { type: "string" },
                        file_path: { type: "string" },
                        mime_type: { type: "string", example: "application/pdf" },
                        size: { type: "integer" },
                        created_at: { type: "string", format: "date-time" },
                    },
                },
                Classroom: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        name: { type: "string" },
                        description: { type: "string", nullable: true },
                        join_code: { type: "string" },
                        teacher_id: { type: "string" },
                        created_at: { type: "string", format: "date-time" },
                    },
                },
                Assignment: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        title: { type: "string" },
                        description: { type: "string", nullable: true },
                        due_date: { type: "string", format: "date-time", nullable: true },
                        type: { type: "string", enum: ["TEXT", "FILE"] },
                        classroom_id: { type: "string" },
                        created_at: { type: "string", format: "date-time" },
                    },
                },
                AssignmentSubmission: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        content: { type: "string" },
                        assignment_id: { type: "string" },
                        student_id: { type: "string" },
                        score: { type: "number", nullable: true },
                        feedback: { type: "string", nullable: true },
                        submitted_at: { type: "string", format: "date-time" },
                    },
                },
                Announcement: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        content: { type: "string" },
                        classroom_id: { type: "string" },
                        author_id: { type: "string" },
                        created_at: { type: "string", format: "date-time" },
                    },
                },
                Exercise: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        type: { type: "string", enum: ["QCU", "QCM", "QRO", "QROA", "CODE", "FILL_BLANKS"] },
                        title: { type: "string" },
                        parameters: { type: "object" },
                        settings: { type: "object" },
                        created_at: { type: "string", format: "date-time" },
                    },
                },
                Submission: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        exercise_id: { type: "string" },
                        student_id: { type: "string" },
                        answers: { type: "object" },
                        score: { type: "number", nullable: true },
                        feedback: { type: "string", nullable: true },
                        submitted_at: { type: "string", format: "date-time" },
                    },
                },
                MarketplaceItem: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        type: { type: "string", enum: ["part", "chapter", "paragraph", "notion"] },
                        title: { type: "string" },
                        price: { type: "number" },
                        downloads: { type: "integer" },
                        seller_id: { type: "string" },
                        published_at: { type: "string", format: "date-time" },
                    },
                },
                VaultItem: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        type: { type: "string" },
                        title: { type: "string" },
                        content: { type: "string", nullable: true },
                        file_url: { type: "string", nullable: true },
                        added_at: { type: "string", format: "date-time" },
                    },
                },
                Invitation: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        host_id: { type: "string" },
                        guest_id: { type: "string" },
                        pr_id: { type: "string" },
                        invitation_token: { type: "string" },
                        invitation_state: { type: "string", enum: ["Pending", "Accepted", "Rejected", "Revoked"] },
                        invited_at: { type: "string", format: "date-time" },
                    },
                },
                Notification: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        user_id: { type: "string" },
                        type: { type: "string", example: "NEW_ASSIGNMENT" },
                        message: { type: "string" },
                        link: { type: "string", nullable: true },
                        is_read: { type: "boolean" },
                        created_at: { type: "string", format: "date-time" },
                    },
                },
                Revision: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        project_id: { type: "string" },
                        author_id: { type: "string" },
                        label: { type: "string", nullable: true },
                        snapshot: { type: "object" },
                        created_at: { type: "string", format: "date-time" },
                    },
                },
                Template: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        template_name: { type: "string" },
                        description: { type: "string", nullable: true },
                        category: { type: "string", nullable: true },
                        is_public: { type: "boolean" },
                        structure: { type: "object" },
                        usage_count: { type: "integer" },
                        creator_id: { type: "string" },
                        created_at: { type: "string", format: "date-time" },
                    },
                },
                ClassroomProject: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        classroom_id: { type: "string" },
                        project_id: { type: "string" },
                        doc_id: { type: "string", nullable: true },
                    },
                },
                UploadResult: {
                    type: "object",
                    properties: {
                        url: { type: "string" },
                        public_id: { type: "string" },
                        format: { type: "string" },
                        size: { type: "integer" },
                    },
                },
                AuditResult: {
                    type: "object",
                    properties: {
                        clarityScore: { type: "integer", minimum: 0, maximum: 100 },
                        engagementScore: { type: "integer", minimum: 0, maximum: 100 },
                        bloomLevel: { type: "string", enum: ["Mémoriser", "Comprendre", "Appliquer", "Analyser", "Évaluer", "Créer"] },
                        suggestions: { type: "array", items: { type: "string" } },
                        recommendedBlocks: { type: "array", items: { type: "string" } },
                    },
                },
                BulkReorderRequest: {
                    type: "object",
                    required: ["type", "items"],
                    properties: {
                        type: { type: "string", enum: ["part", "chapter", "paragraph", "notion"] },
                        items: { type: "array", items: { type: "object", properties: { id: { type: "string" }, number: { type: "integer" } } } },
                    },
                },
                MoveGranuleRequest: {
                    type: "object",
                    required: ["type", "itemId", "newParentId"],
                    properties: {
                        type: { type: "string", enum: ["chapter", "paragraph", "notion"] },
                        itemId: { type: "string" },
                        newParentId: { type: "string" },
                        newNumber: { type: "integer" },
                    },
                },
                Enrollment: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        student_id: { type: "string" },
                        classroom_id: { type: "string" },
                        enrolled_at: { type: "string", format: "date-time" },
                    },
                },
            },
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
    console.log(`✅ Swagger spec generated → public/swagger.json`);
    console.log(`   Paths: ${Object.keys(spec.paths || {}).length}`);
    console.log(`   Schemas: ${Object.keys(spec.components?.schemas || {}).length}`);
} catch (error) {
    console.error("❌ Error generating Swagger spec:", error);
    process.exit(1);
}
