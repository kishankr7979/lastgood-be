import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export default async function healthRoutes(fastify: FastifyInstance) {
    fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
        return { status: 'ok', timestamp: new Date().toISOString() };
    });
}
