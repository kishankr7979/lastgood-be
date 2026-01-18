import { FastifyInstance } from 'fastify';
import { RewindController } from '../controllers/RewindController';
import { authenticateJWT } from '../middleware/auth';

export default async function rewindRoutes(fastify: FastifyInstance) {


    // Add JWT authentication middleware to all routes
    fastify.addHook('preHandler', authenticateJWT);

    // GET /rewind - Get change events within a time window before an incident
    fastify.get('/rewind', RewindController.rewindEvents);

    // GET /rewind/summary - Get a summary of changes before an incident with risk assessment
    fastify.get('/rewind/summary', RewindController.rewindSummary);
}