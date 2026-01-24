import { FastifyInstance } from 'fastify';

export interface Organization {
    id: string;
    name: string;
    slug: string | null;
    plan: 'free' | 'starter' | 'pro' | 'enterprise';
    created_at: Date;
    updated_at: Date;
}

export interface CreateOrganizationData {
    id?: string;
    name: string;
    slug?: string;
    plan?: 'free' | 'starter' | 'pro' | 'enterprise';
}

export interface UpdateOrganizationData {
    name?: string;
    slug?: string;
    plan?: 'free' | 'starter' | 'pro' | 'enterprise';
}

export interface OrganizationFilters {
    plan?: string;
    name_search?: string;
    limit?: number;
    offset?: number;
}

export class OrganizationModel {
    private fastify: FastifyInstance;

    constructor(fastify: FastifyInstance) {
        this.fastify = fastify;
    }

    async getAll(filters: OrganizationFilters = {}): Promise<Organization[]> {
        const client = await this.fastify.pg.connect();
        try {
            let query = 'SELECT * FROM organizations WHERE 1=1';
            const values: any[] = [];
            let paramCount = 1;

            // Apply filters
            if (filters.plan) {
                query += ` AND plan = $${paramCount++}`;
                values.push(filters.plan);
            }

            if (filters.name_search) {
                query += ` AND name ILIKE $${paramCount++}`;
                values.push(`%${filters.name_search}%`);
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

    async getById(id: string): Promise<Organization | null> {
        const client = await this.fastify.pg.connect();
        try {
            const { rows } = await client.query('SELECT * FROM organizations WHERE id = $1', [id]);
            return rows[0] || null;
        } finally {
            client.release();
        }
    }

    async getBySlug(slug: string): Promise<Organization | null> {
        const client = await this.fastify.pg.connect();
        try {
            const { rows } = await client.query('SELECT * FROM organizations WHERE slug = $1', [slug]);
            return rows[0] || null;
        } finally {
            client.release();
        }
    }

    async create(orgData: CreateOrganizationData): Promise<Organization> {
        const client = await this.fastify.pg.connect();
        try {
            // Generate slug from name if not provided
            let slug = orgData.slug;
            if (!slug && orgData.name) {
                slug = this.generateSlug(orgData.name);
            }

            const { rows } = await client.query(
                `INSERT INTO organizations (id, name, slug, plan) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
                [
                    orgData.id || null, // Let PostgreSQL generate UUID if not provided
                    orgData.name,
                    slug,
                    orgData.plan || 'free'
                ]
            );
            return rows[0];
        } finally {
            client.release();
        }
    }

    async update(id: string, orgData: UpdateOrganizationData): Promise<Organization | null> {
        const client = await this.fastify.pg.connect();
        try {
            const setParts: string[] = [];
            const values: any[] = [];
            let paramCount = 1;

            if (orgData.name !== undefined) {
                setParts.push(`name = $${paramCount++}`);
                values.push(orgData.name);
            }

            if (orgData.slug !== undefined) {
                setParts.push(`slug = $${paramCount++}`);
                values.push(orgData.slug);
            }

            if (orgData.plan !== undefined) {
                setParts.push(`plan = $${paramCount++}`);
                values.push(orgData.plan);
            }

            if (setParts.length === 0) {
                return this.getById(id);
            }

            values.push(id);
            const query = `UPDATE organizations SET ${setParts.join(', ')} WHERE id = $${paramCount} RETURNING *`;

            const { rows } = await client.query(query, values);
            return rows[0] || null;
        } finally {
            client.release();
        }
    }

    async delete(id: string): Promise<boolean> {
        const client = await this.fastify.pg.connect();
        try {
            const { rowCount } = await client.query('DELETE FROM organizations WHERE id = $1', [id]);
            return (rowCount ?? 0) > 0;
        } finally {
            client.release();
        }
    }

    async count(filters: Omit<OrganizationFilters, 'limit' | 'offset'> = {}): Promise<number> {
        const client = await this.fastify.pg.connect();
        try {
            let query = 'SELECT COUNT(*) as count FROM organizations WHERE 1=1';
            const values: any[] = [];
            let paramCount = 1;

            // Apply same filters as getAll (excluding pagination)
            if (filters.plan) {
                query += ` AND plan = $${paramCount++}`;
                values.push(filters.plan);
            }

            if (filters.name_search) {
                query += ` AND name ILIKE $${paramCount++}`;
                values.push(`%${filters.name_search}%`);
            }

            const { rows } = await client.query(query, values);
            return parseInt(rows[0].count);
        } finally {
            client.release();
        }
    }

    async getStats(): Promise<{
        total: number;
        by_plan: Record<string, number>;
    }> {
        const client = await this.fastify.pg.connect();
        try {
            const [totalResult, planResult] = await Promise.all([
                client.query('SELECT COUNT(*) as count FROM organizations'),
                client.query('SELECT plan, COUNT(*) as count FROM organizations GROUP BY plan ORDER BY plan')
            ]);

            const byPlan = planResult.rows.reduce((acc, row) => {
                acc[row.plan] = parseInt(row.count);
                return acc;
            }, {} as Record<string, number>);

            return {
                total: parseInt(totalResult.rows[0].count),
                by_plan: byPlan
            };
        } finally {
            client.release();
        }
    }

    private generateSlug(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Replace multiple hyphens with single
            .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    }
}