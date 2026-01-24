import { FastifyInstance } from 'fastify';
import { GitHubWebhookController } from '../controllers/GithubWebhookController';
import { authenticateApiKey } from '../middleware/auth';

export default async function githubWebhookRoutes(fastify: FastifyInstance) {
    // fastify.addHook('preHandler', authenticateApiKey);
    fastify.post(
        '/webhooks/github/:orgId',
        {
            config: {
                rawBody: true // IMPORTANT for signature verification later
            }
        },
        GitHubWebhookController.handle
    );
}
