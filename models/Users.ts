import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';

export interface User {
    id: string;
    org_id: string | null;
    email: string;
    password_hash: string;
    role: string | null;
    invited_at: Date;
    joined_at: Date | null;
    created_at: Date;
    temp_pwd_reset: boolean
}

export interface CreateUserData {
    email: string;
    password: string;
    org_id?: string;
    role?: string;
}

export interface ResetPasswordData {
    id: string;
    org_id: string;
    new_password: string
}

export class UserModel {
    private pool: Pool;
    private dbName: string = 'users';

    constructor(fastify: FastifyInstance) {
        if (!fastify.pg) {
            throw new Error('Database connection not initialized');
        }
        this.pool = fastify.pg as any;
    }

    async hashPassword(password: string): Promise<string> {
        const saltRounds = 10;
        return bcrypt.hash(password, saltRounds);
    }

    async verifyPassword(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }

    async findByEmail(email: string): Promise<User | null> {
        const query = `
            SELECT * FROM ${this.dbName}
            WHERE email = $1
        `;
        const result = await this.pool.query(query, [email]);
        return result.rows[0] || null;
    }

    async findById(id: string): Promise<User | null> {
        const query = `
            SELECT * FROM ${this.dbName}
            WHERE id = $1
        `;
        const result = await this.pool.query(query, [id]);
        return result.rows[0] || null;
    }

    async create(data: CreateUserData): Promise<User> {
        const passwordHash = await this.hashPassword(data.password);
        const id = crypto.randomUUID();

        const query = `
            INSERT INTO ${this.dbName} (id, email, password_hash, org_id, role, joined_at)
            VALUES ($1, $2, $3, $4, $5, now())
            RETURNING *
        `;
        const values = [
            id,
            data.email,
            passwordHash,
            data.org_id || null,
            data.role || 'user'
        ];
        const result = await this.pool.query(query, values);
        return result.rows[0];
    }

    async resetPassword(data: ResetPasswordData): Promise<User> {
        const passwordHash = await this.hashPassword(data.new_password);

        const user = await this.findById(data.id);

        if (user?.temp_pwd_reset) {
            throw new Error('Default password already reset, Please go through forgot flow now');


        }
        const query = `
            UPDATE ${this.dbName}
            SET password_hash = $1, temp_pwd_reset = true
            WHERE id = $2
            RETURNING *
        `;

        const result = await this.pool.query(query, [passwordHash, data.id]);
        return result.rows[0];

    }

    async updateOrganization(userId: string, orgId: string): Promise<User | null> {
        const query = `
            UPDATE ${this.dbName}
            SET org_id = $1
            WHERE id = $2
            RETURNING *
        `;
        const result = await this.pool.query(query, [orgId, userId]);
        return result.rows[0] || null;
    }
}
