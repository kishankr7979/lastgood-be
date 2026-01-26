import { FastifyRequest, FastifyReply } from 'fastify';
import { ApiKeyModel, ApiKeyFilters } from '../models/ApiKey';

export class ApiKeyController {
    static async getAllApiKeys(
        request: FastifyRequest<{
            Querystring: {
                active_only?: string;
                limit?: string;
                offset?: string;
            }
        }>,
        reply: FastifyReply
    ) {
        try {
            const filters: ApiKeyFilters = {
                organization_id: request.organization_id
            };

            // Parse query parameters
            if (request.query.active_only === 'true') {
                filters.active_only = true;
            }

            if (request.query.limit) {
                const limit = parseInt(request.query.limit);
                if (isNaN(limit) || limit < 1 || limit > 1000) {
                    return reply.code(400).send({
                        success: false,
                        message: 'Limit must be a number between 1 and 1000'
                    });
                }
                filters.limit = limit;
            }

            if (request.query.offset) {
                const offset = parseInt(request.query.offset);
                if (isNaN(offset) || offset < 0) {
                    return reply.code(400).send({
                        success: false,
                        message: 'Offset must be a non-negative number'
                    });
                }
                filters.offset = offset;
            }

            const apiKeyModel = new ApiKeyModel(request.server);
            const [apiKeys, totalCount] = await Promise.all([
                apiKeyModel.getAll(filters),
                apiKeyModel.count(filters)
            ]);

            // Remove key_hash from response for security
            const sanitizedKeys = apiKeys.map(key => ({
                id: key.id,
                organization_id: key.organization_id,
                name: key.name,
                last_used_at: key.last_used_at,
                created_at: key.created_at,
                revoked_at: key.revoked_at,
                is_active: !key.revoked_at
            }));

            return reply.code(200).send({
                success: true,
                data: sanitizedKeys,
                pagination: {
                    total: totalCount,
                    count: sanitizedKeys.length,
                    limit: filters.limit || null,
                    offset: filters.offset || 0
                }
            });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    static async getApiKeyById(
        request: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply
    ) {
        try {
            const { id } = request.params;

            // Basic UUID validation
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(id)) {
                return reply.code(400).send({
                    success: false,
                    message: 'Invalid UUID format'
                });
            }

            const apiKeyModel = new ApiKeyModel(request.server);

            const apiKey = await apiKeyModel.getById(id);


            if (!apiKey) {
                return reply.code(404).send({
                    success: false,
                    message: 'API key not found'
                });
            }



            // Ensure the API key belongs to the authenticated organization
            if (apiKey.organization_id !== request.organization_id) {
                return reply.code(404).send({
                    success: false,
                    message: 'API key not found'
                });
            }



            return reply.code(200).send({
                success: true,
                data: apiKey
            });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    static async createApiKey(
        request: FastifyRequest<{ Body: { name: string } }>,
        reply: FastifyReply
    ) {
        try {
            const { name } = request.body;

            // Validate required fields
            if (!name || name.trim().length === 0) {
                return reply.code(400).send({
                    success: false,
                    message: 'API key name is required'
                });
            }

            // Validate name length
            if (name.length > 255) {
                return reply.code(400).send({
                    success: false,
                    message: 'API key name must be 255 characters or less'
                });
            }

            const apiKeyModel = new ApiKeyModel(request.server);
            const newApiKey = await apiKeyModel.create({
                organization_id: request.organization_id,
                name: name.trim()
            });

            // Return the API key with the plain text key (only time it's exposed)
            const response = {
                id: newApiKey.id,
                organization_id: newApiKey.organization_id,
                name: newApiKey.name,
                api_key: newApiKey.api_key, // Plain text key - only shown once!
                created_at: newApiKey.created_at,
                is_active: true
            };

            return reply.code(201).send({
                success: true,
                data: response,
                warning: 'This is the only time the API key will be shown. Please store it securely.'
            });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    static async revokeApiKey(
        request: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply
    ) {
        try {
            const { id } = request.params;

            // Basic UUID validation
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(id)) {
                return reply.code(400).send({
                    success: false,
                    message: 'Invalid UUID format'
                });
            }

            const apiKeyModel = new ApiKeyModel(request.server);

            // First check if the key exists and belongs to the organization
            const apiKey = await apiKeyModel.getById(id);
            if (!apiKey || apiKey.organization_id !== request.organization_id) {
                return reply.code(404).send({
                    success: false,
                    message: 'API key not found'
                });
            }

            // Check if already revoked
            if (apiKey.revoked_at) {
                return reply.code(400).send({
                    success: false,
                    message: 'API key is already revoked'
                });
            }

            const revoked = await apiKeyModel.revoke(id);

            if (!revoked) {
                return reply.code(404).send({
                    success: false,
                    message: 'API key not found or already revoked'
                });
            }

            return reply.code(200).send({
                success: true,
                message: 'API key revoked successfully'
            });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    static async deleteApiKey(
        request: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply
    ) {
        try {
            const { id } = request.params;

            // Basic UUID validation
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(id)) {
                return reply.code(400).send({
                    success: false,
                    message: 'Invalid UUID format'
                });
            }

            const apiKeyModel = new ApiKeyModel(request.server);

            // First check if the key exists and belongs to the organization
            const apiKey = await apiKeyModel.getById(id);
            if (!apiKey || apiKey.organization_id !== request.organization_id) {
                return reply.code(404).send({
                    success: false,
                    message: 'API key not found'
                });
            }

            const deleted = await apiKeyModel.delete(id);

            if (!deleted) {
                return reply.code(404).send({
                    success: false,
                    message: 'API key not found'
                });
            }

            return reply.code(200).send({
                success: true,
                message: 'API key deleted successfully'
            });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                success: false,
                message: 'Internal server error'
            });
        }
    }
}