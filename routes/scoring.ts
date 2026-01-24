import { FastifyInstance } from 'fastify';
import { ScoringController } from '../controllers/ScoringController';
import { authenticateJWT } from '../middleware/auth';

export default async function scoringRoutes(fastify: FastifyInstance) {
    // Add JWT authentication middleware to all routes
    fastify.addHook('preHandler', authenticateJWT);

    // GET /scoring/incident - Score all changes related to an incident
    fastify.get('/scoring/incident', ScoringController.scoreIncident);

    // GET /scoring/event/:id - Score a specific change event against an incident
    fastify.get('/scoring/event/:id', ScoringController.scoreEvent);

    // GET /scoring/methodology - Explain the scoring methodology
    fastify.get('/scoring/methodology', ScoringController.explainScoring);
}