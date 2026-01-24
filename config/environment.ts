import dotenv from 'dotenv';
import path from 'path';

// Load environment-specific .env file
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = nodeEnv === 'development' ? '.env' : `.env.${nodeEnv}`;

dotenv.config({ path: path.resolve(process.cwd(), envFile) });

export interface Config {
    nodeEnv: string;
    port: number;
    host: string;
    database: {
        host: string;
        port: number;
        name: string;
        user: string;
        password: string;
    };
    api: {
        version: string;
        prefix: string;
    };
    security: {
        jwtSecret: string;
        jwtExpiresIn: string;
    };
    logging: {
        level: string;
    };
    cors: {
        origin: string[];
    };
    rateLimit: {
        max: number;
        windowMs: number;
    };
}

const config: Config = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        name: process.env.DB_NAME || 'lastgood_dev',
        user: process.env.DB_USER || 'dev_user',
        password: process.env.DB_PASSWORD || 'dev_password',
    },
    api: {
        version: process.env.API_VERSION || 'v1',
        prefix: process.env.API_PREFIX || '/api',
    },
    security: {
        jwtSecret: process.env.JWT_SECRET || 'fallback-secret-key',
        jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info',
    },
    cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    },
    rateLimit: {
        max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10),
    },
};

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0 && config.nodeEnv === 'production') {
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

export default config;