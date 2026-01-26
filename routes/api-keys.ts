import { FastifyInstance } from 'fastify';
import { ApiKeyController } from '../controllers/ApiKeyController';
import { authenticateJWT } from '../middleware/auth';

export default async function apiKeyRoutes(fastify: FastifyInstance) {
    // Add JWT authentication middleware to all routes
    fastify.addHook('preHandler', authenticateJWT);

    fastify.post('/api-keys/create', ApiKeyController.createApiKey);

    // // GET /api-keys/:id - Get API key by orgId
    fastify.get('/api-keys/:id', ApiKeyController.getApiKeyById);

    // // POST /api-keys - Create new API key
    // fastify.post('/api-keys', ApiKeyController.createApiKey);

    // // PUT /api-keys/:id/revoke - Revoke API key
    // fastify.put('/api-keys/:id/revoke', ApiKeyController.revokeApiKey);

    // // DELETE /api-keys/:id - Delete API key
    // fastify.delete('/api-keys/:id', ApiKeyController.deleteApiKey);
}