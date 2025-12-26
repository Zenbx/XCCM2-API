/**
 * @fileoverview Page web affichant l'interface Swagger UI
 * Permet d'explorer et tester l'API de manière interactive
 */

"use client";

import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

/**
 * Composant de la page de documentation Swagger
 * @returns Page React avec l'interface Swagger UI
 */
export default function DocsPage() {
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto py-8 px-4">
                <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">
                        Documentation API XCCM
                    </h1>
                    <p className="text-gray-600">
                        Documentation interactive de l'API REST. Explorez et testez les
                        endpoints directement depuis cette interface.
                    </p>
                    <div className="mt-4 p-4 bg-blue-50 rounded border-l-4 border-blue-500">
                        <p className="text-sm text-blue-800">
                            <strong>💡 Astuce :</strong> Pour tester les endpoints protégés, cliquez sur le bouton
                            <strong> "Authorize" </strong> en haut à droite et entrez votre token JWT.
                        </p>
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                    <SwaggerUI url="/api/docs" />
                </div>
            </div>
        </div>
    );
}