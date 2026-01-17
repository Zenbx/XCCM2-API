import { Rest } from 'ably';

const ablyApiKey = process.env.ABLY_API_KEY;

// Initialisation du client Ably côté serveur
const ably = new Rest({ key: ablyApiKey });

/**
 * Service de gestion des événements temps réel via Ably
 */
class RealtimeService {
    /**
     * Broadcast un événement de modification de structure
     * @param projectName - Nom du projet
     * @param event - Type d'événement (NOTION_UPDATED, STRUCTURE_REORDERED, etc.)
     * @param data - Données associées à l'événement
     */
    async broadcastStructureChange(
        projectName: string,
        event: string,
        data: any
    ): Promise<void> {
        try {
            const channel = ably.channels.get(`project:${projectName}`);
            await channel.publish(event, data);
            console.log(`📡 Broadcasted ${event} to project:${projectName}`);
        } catch (error) {
            console.error('Error broadcasting event:', error);
        }
    }

    /**
     * Génère un token Ably pour l'authentification client
     * @param clientId - ID unique du client (userId)
     * @returns Token Ably temporaire
     */
    async createClientToken(clientId: string): Promise<string> {
        try {
            const tokenRequest = await ably.auth.createTokenRequest({ clientId });
            return JSON.stringify(tokenRequest);
        } catch (error) {
            console.error('Error creating Ably token:', error);
            throw error;
        }
    }
}

export const realtimeService = new RealtimeService();
