import { FastifyInstance } from 'fastify';
import fastifyPostgres from '@fastify/postgres';
import config from '../config/environment';

export async function registerDatabase(fastify: FastifyInstance) {
    try {
        await fastify.register(fastifyPostgres, {
            connectionString: `postgresql://${config.database.user}:${config.database.password}@${config.database.host}:${config.database.port}/${config.database.name}?options=-c%20search_path%3Ddevelopment`,
            ssl: {
                rejectUnauthorized: false,
            }

            // Alternative object configuration:
            // host: config.database.host,
            // port: config.database.port,
            // database: config.database.name,
            // user: config.database.user,
            // password: config.database.password,
        });

        console.log('✅ PostgreSQL connected successfully');
    } catch (error) {
        console.error('❌ PostgreSQL connection failed:', error);
        throw error;
    }
}