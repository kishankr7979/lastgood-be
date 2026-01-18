import { FastifyRequest, FastifyReply } from 'fastify';
import { ApiKeyModel } from '../models/ApiKey';
import { UserModel } from '../models/Users';
import jwt from 'jsonwebtoken';
import config from '../config/environment';

// Extend FastifyRequest to include organization_id and user info
declare module 'fastify' {
    interface FastifyRequest {
        organization_id: string;
        api_key_id?: string;
        user?: {
            userId: string;
            email: string;
            orgId: string | null;
            role: string | null;
        };
    }
}

export interface AuthenticatedRequest extends FastifyRequest {
    organization_id: string;
    api_key_id: string;
}

export async function authenticateApiKey(
    request: FastifyRequest,
    reply: FastifyReply
) {
    try {
        // Get API key from Authorization header
        const authHeader = request.headers.authorization;


        if (!authHeader) {
            return reply.code(401).send({
                success: false,
                message: 'Missing Authorization header'
            });
        }

        // Expected format: "Bearer <api_key>" or just "<api_key>"
        let apiKey: string;
        if (authHeader.startsWith('Bearer ')) {
            apiKey = authHeader.substring(7);
        } else {
            apiKey = authHeader;
        }





        if (!apiKey) {
            return reply.code(401).send({
                success: false,
                message: 'Invalid Authorization header format'
            });
        }

        // Hash the provided API key
        const keyHash = ApiKeyModel.hashApiKey(apiKey);



        // Look up the API key in the database
        const apiKeyModel = new ApiKeyModel(request.server);
        const apiKeyRecord = await apiKeyModel.getByKeyHash(keyHash);

        if (!apiKeyRecord) {
            return reply.code(401).send({
                success: false,
                message: 'Invalid API key'
            });
        }

        // Check if the key is revoked
        if (apiKeyRecord.revoked_at) {
            return reply.code(401).send({
                success: false,
                message: 'API key has been revoked'
            });
        }

        // Update last used timestamp (fire and forget)
        apiKeyModel.updateLastUsed(keyHash).catch(err => {
            request.log.warn('Failed to update API key last_used_at:', err);
        });

        // Attach organization_id and api_key_id to request
        request.organization_id = apiKeyRecord.organization_id;
        request.api_key_id = apiKeyRecord.id;

        // Continue to the next handler
    } catch (error) {
        request.log.error('Authentication error:');
        return reply.code(500).send({
            success: false,
            message: 'Internal server error during authentication'
        });
    }
}

// Optional authentication - doesn't fail if no API key provided
export async function optionalAuth(
    request: FastifyRequest,
    reply: FastifyReply
) {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
        // No auth header, continue without authentication
        return;
    }

    // If auth header is present, validate it
    return authenticateApiKey(request, reply);
}

// Middleware to ensure request is authenticated
export function requireAuth() {
    return async function (request: FastifyRequest, reply: FastifyReply) {
        if (!request.organization_id) {
            return reply.code(401).send({
                success: false,
                message: 'Authentication required'
            });
        }
    };
}

// JWT Authentication Middleware for UI routes
export async function authenticateJWT(
    request: FastifyRequest,
    reply: FastifyReply
) {
    try {
        const authHeader = request.headers.authorization;

        if (!authHeader) {
            return reply.code(401).send({
                success: false,
                message: 'Missing Authorization header'
            });
        }

        // Expected format: "Bearer <token>"
        if (!authHeader.startsWith('Bearer ')) {
            return reply.code(401).send({
                success: false,
                message: 'Invalid Authorization header format. Expected: Bearer <token>'
            });
        }

        const token = authHeader.substring(7);

        if (!token) {
            return reply.code(401).send({
                success: false,
                message: 'Missing token'
            });
        }

        // Verify JWT token
        const decoded = jwt.verify(token, config.security.jwtSecret as string) as {
            userId: string;
            email: string;
            orgId: string | null;
            role: string | null;
        };

        // Attach user info to request
        request.user = decoded;

        // Set organization_id if available
        if (decoded.orgId) {
            request.organization_id = decoded.orgId;
        }

        // Continue to the next handler
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            return reply.code(401).send({
                success: false,
                message: 'Invalid token'
            });
        }
        if (error instanceof jwt.TokenExpiredError) {
            return reply.code(401).send({
                success: false,
                message: 'Token expired'
            });
        }
        request.log.error(error, 'JWT Authentication error');
        return reply.code(500).send({
            success: false,
            message: 'Internal server error during authentication'
        });
    }
}