import { FastifyInstance } from 'fastify';
import crypto from 'crypto';

export interface ApiKey {
    id: string;
    organization_id: string;
    name: string;
    key_hash: string;
    last_used_at: Date | null;
    created_at: Date;
    revoked_at: Date | null;
}

export interface CreateApiKeyData {
    organization_id: string;
    name: string;
}

export interface ApiKeyWithPlainKey extends Omit<ApiKey, 'key_hash'> {
    api_key: string; // The plain text API key (only returned on creation)
}

export interface ApiKeyFilters {
    organization_id?: string;
    active_only?: boolean;
    limit?: number;
    offset?: number;
}

export class ApiKeyModel {
    private fastify: FastifyInstance;

    constructor(fastify: FastifyInstance) {
        this.fastify = fastify;
    }

    // Generate a secure API key
    static generateApiKey(): string {
        // Generate a 32-byte random key and encode as base64url
        const buffer = crypto.randomBytes(32);
        return buffer.toString('base64url');
    }

    // Hash an API key for storage
    static hashApiKey(apiKey: string): string {
        return crypto.createHash('sha256').update(apiKey).digest('hex');
    }

    async getAll(filters: ApiKeyFilters = {}): Promise<ApiKey[]> {
        const client = await this.fastify.pg.connect();
        try {
            let query = 'SELECT * FROM api_keys WHERE 1=1';
            const values: any[] = [];
            let paramCount = 1;

            // Apply filters
            if (filters.organization_id) {
                query += ` AND organization_id = $${paramCount++}`;
                values.push(filters.organization_id);
            }

            if (filters.active_only) {
                query += ` AND revoked_at IS NULL`;
            }

            // Order by created_at descending
            query += ' ORDER BY created_at DESC';

            // Apply pagination
            if (filters.limit) {
                query += ` LIMIT $${paramCount++}`;
                values.push(filters.limit);
            }

            if (filters.offset) {
                query += ` OFFSET $${paramCount++}`;
                values.push(filters.offset);
            }

            const { rows } = await client.query(query, values);
            return rows;
        } finally {
            client.release();
        }
    }

    async getById(id: string): Promise<ApiKey | null> {
        const client = await this.fastify.pg.connect();
        try {
            const { rows } = await client.query('SELECT * FROM api_keys WHERE id = $1', [id]);
            return rows[0] || null;
        } finally {
            client.release();
        }
    }

    async getByKeyHash(keyHash: string): Promise<ApiKey | null> {
        const client = await this.fastify.pg.connect();
        try {
            const { rows } = await client.query(
                'SELECT * FROM api_keys WHERE key_hash = $1 AND revoked_at IS NULL',
                [keyHash]
            );
            return rows[0] || null;
        } finally {
            client.release();
        }
    }

    async create(keyData: CreateApiKeyData): Promise<ApiKeyWithPlainKey> {
        const client = await this.fastify.pg.connect();
        try {
            // Generate API key and hash
            const apiKey = ApiKeyModel.generateApiKey();
            const keyHash = ApiKeyModel.hashApiKey(apiKey);

            const { rows } = await client.query(
                `INSERT INTO api_keys (organization_id, name, key_hash) 
         VALUES ($1, $2, $3) RETURNING *`,
                [keyData.organization_id, keyData.name, keyHash]
            );

            const createdKey = rows[0];

            // Return the API key with the plain text key (only time it's exposed)
            return {
                ...createdKey,
                api_key: apiKey
            };
        } finally {
            client.release();
        }
    }

    async updateLastUsed(keyHash: string): Promise<void> {
        const client = await this.fastify.pg.connect();
        try {
            await client.query(
                'UPDATE api_keys SET last_used_at = now() WHERE key_hash = $1',
                [keyHash]
            );
        } finally {
            client.release();
        }
    }

    async revoke(id: string): Promise<boolean> {
        const client = await this.fastify.pg.connect();
        try {
            const { rowCount } = await client.query(
                'UPDATE api_keys SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL',
                [id]
            );
            return (rowCount ?? 0) > 0;
        } finally {
            client.release();
        }
    }

    async delete(id: string): Promise<boolean> {
        const client = await this.fastify.pg.connect();
        try {
            const { rowCount } = await client.query('DELETE FROM api_keys WHERE id = $1', [id]);
            return (rowCount ?? 0) > 0;
        } finally {
            client.release();
        }
    }

    async count(filters: Omit<ApiKeyFilters, 'limit' | 'offset'> = {}): Promise<number> {
        const client = await this.fastify.pg.connect();
        try {
            let query = 'SELECT COUNT(*) as count FROM api_keys WHERE 1=1';
            const values: any[] = [];
            let paramCount = 1;

            // Apply same filters as getAll (excluding pagination)
            if (filters.organization_id) {
                query += ` AND organization_id = $${paramCount++}`;
                values.push(filters.organization_id);
            }

            if (filters.active_only) {
                query += ` AND revoked_at IS NULL`;
            }

            const { rows } = await client.query(query, values);
            return parseInt(rows[0].count);
        } finally {
            client.release();
        }
    }

    // Create default API key for new organization
    async createDefaultKey(organizationId: string, organizationName: string): Promise<ApiKeyWithPlainKey> {
        return this.create({
            organization_id: organizationId,
            name: `Default API Key for ${organizationName}`
        });
    }
}