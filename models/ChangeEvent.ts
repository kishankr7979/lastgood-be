import { FastifyInstance } from 'fastify';

export interface ChangeEvent {
    id: string;
    organization_id: string;
    occurred_at: Date;
    service: string;
    environment: string;
    type: string;
    source: string;
    summary: string;
    meta: Record<string, any>;
    created_at: Date;
}

export interface CreateChangeEventData {
    id?: string;
    organization_id: string;
    occurred_at: Date;
    service: string;
    environment: string;
    type: string;
    source: string;
    summary: string;
    meta?: Record<string, any>;
}

export interface UpdateChangeEventData {
    occurred_at?: Date;
    service?: string;
    environment?: string;
    type?: string;
    source?: string;
    summary?: string;
    meta?: Record<string, any>;
}

export interface ChangeEventFilters {
    organization_id?: string;
    service?: string;
    environment?: string;
    type?: string;
    source?: string;
    from_date?: Date;
    to_date?: Date;
    limit?: number;
    offset?: number;
}

export class ChangeEventModel {
    private fastify: FastifyInstance;

    constructor(fastify: FastifyInstance) {
        this.fastify = fastify;
    }

    async getAll(filters: ChangeEventFilters = {}): Promise<ChangeEvent[]> {
        const client = await this.fastify.pg.connect();
        try {
            let query = 'SELECT * FROM change_events WHERE 1=1';
            const values: any[] = [];
            let paramCount = 1;

            // Apply filters
            if (filters.organization_id) {
                query += ` AND org_id = $${paramCount++}`;
                values.push(filters.organization_id);
            }

            if (filters.service) {
                query += ` AND service = $${paramCount++}`;
                values.push(filters.service);
            }

            if (filters.environment) {
                query += ` AND environment = $${paramCount++}`;
                values.push(filters.environment);
            }

            if (filters.type) {
                query += ` AND type = $${paramCount++}`;
                values.push(filters.type);
            }

            if (filters.source) {
                query += ` AND source = $${paramCount++}`;
                values.push(filters.source);
            }

            if (filters.from_date) {
                query += ` AND occurred_at >= $${paramCount++}`;
                values.push(filters.from_date);
            }

            if (filters.to_date) {
                query += ` AND occurred_at <= $${paramCount++}`;
                values.push(filters.to_date);
            }

            // Order by occurred_at descending
            query += ' ORDER BY occurred_at DESC';

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

    async getById(id: string): Promise<ChangeEvent | null> {
        const client = await this.fastify.pg.connect();
        try {
            const { rows } = await client.query('SELECT * FROM change_events WHERE id = $1', [id]);
            return rows[0] || null;
        } finally {
            client.release();
        }
    }

    async create(eventData: CreateChangeEventData): Promise<ChangeEvent> {
        const client = await this.fastify.pg.connect();

        try {
            const { rows } = await client.query(
                `INSERT INTO change_events (id, org_id, occurred_at, service, environment, type, source, summary, meta) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                [
                    eventData.id || null, // Let PostgreSQL generate UUID if not provided
                    eventData.organization_id,
                    eventData.occurred_at,
                    eventData.service,
                    eventData.environment,
                    eventData.type,
                    eventData.source,
                    eventData.summary,
                    JSON.stringify(eventData.meta || {})
                ]
            );
            return rows[0];
        } finally {
            client.release();
        }
    }

    async update(id: string, eventData: UpdateChangeEventData): Promise<ChangeEvent | null> {
        const client = await this.fastify.pg.connect();
        try {
            const setParts: string[] = [];
            const values: any[] = [];
            let paramCount = 1;

            if (eventData.occurred_at !== undefined) {
                setParts.push(`occurred_at = $${paramCount++}`);
                values.push(eventData.occurred_at);
            }

            if (eventData.service !== undefined) {
                setParts.push(`service = $${paramCount++}`);
                values.push(eventData.service);
            }

            if (eventData.environment !== undefined) {
                setParts.push(`environment = $${paramCount++}`);
                values.push(eventData.environment);
            }

            if (eventData.type !== undefined) {
                setParts.push(`type = $${paramCount++}`);
                values.push(eventData.type);
            }

            if (eventData.source !== undefined) {
                setParts.push(`source = $${paramCount++}`);
                values.push(eventData.source);
            }

            if (eventData.summary !== undefined) {
                setParts.push(`summary = $${paramCount++}`);
                values.push(eventData.summary);
            }

            if (eventData.meta !== undefined) {
                setParts.push(`meta = $${paramCount++}`);
                values.push(JSON.stringify(eventData.meta));
            }

            if (setParts.length === 0) {
                return this.getById(id);
            }

            values.push(id);
            const query = `UPDATE change_events SET ${setParts.join(', ')} WHERE id = $${paramCount} RETURNING *`;

            const { rows } = await client.query(query, values);
            return rows[0] || null;
        } finally {
            client.release();
        }
    }

    async delete(id: string): Promise<boolean> {
        const client = await this.fastify.pg.connect();
        try {
            const { rowCount } = await client.query('DELETE FROM change_events WHERE id = $1', [id]);
            return (rowCount ?? 0) > 0;
        } finally {
            client.release();
        }
    }

    async count(filters: Omit<ChangeEventFilters, 'limit' | 'offset'> = {}): Promise<number> {
        const client = await this.fastify.pg.connect();
        try {
            let query = 'SELECT COUNT(*) as count FROM change_events WHERE 1=1';
            const values: any[] = [];
            let paramCount = 1;

            // Apply same filters as getAll (excluding pagination)
            if (filters.service) {
                query += ` AND service = $${paramCount++}`;
                values.push(filters.service);
            }

            if (filters.environment) {
                query += ` AND environment = $${paramCount++}`;
                values.push(filters.environment);
            }

            if (filters.type) {
                query += ` AND type = $${paramCount++}`;
                values.push(filters.type);
            }

            if (filters.source) {
                query += ` AND source = $${paramCount++}`;
                values.push(filters.source);
            }

            if (filters.from_date) {
                query += ` AND occurred_at >= $${paramCount++}`;
                values.push(filters.from_date);
            }

            if (filters.to_date) {
                query += ` AND occurred_at <= $${paramCount++}`;
                values.push(filters.to_date);
            }

            const { rows } = await client.query(query, values);
            return parseInt(rows[0].count);
        } finally {
            client.release();
        }
    }

    async getDistinctValues(field: 'service' | 'environment' | 'type' | 'source'): Promise<string[]> {
        const client = await this.fastify.pg.connect();
        try {
            const { rows } = await client.query(`SELECT DISTINCT ${field} FROM change_events ORDER BY ${field}`);
            return rows.map(row => row[field]);
        } finally {
            client.release();
        }
    }
}