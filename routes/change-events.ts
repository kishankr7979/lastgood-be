import { FastifyInstance } from 'fastify';
import { ChangeEventController } from '../controllers/ChangeEventController';
import { CreateChangeEventData } from '../models/ChangeEvent';
import { authenticateApiKey, authenticateJWT } from '../middleware/auth';

export default async function changeEventRoutes(fastify: FastifyInstance) {
    // POST /change-events - Create new change event (API key authentication only)
    // Register in separate context to avoid JWT middleware
    await fastify.register(async (instance) => {
        instance.addHook('preHandler', authenticateApiKey);
        instance.post('/change-events', ChangeEventController.createChangeEvent);
    });

    // All other routes use JWT authentication
    await fastify.register(async (instance) => {
        instance.addHook('preHandler', authenticateJWT);

        // GET /change-events - Get all change events with filtering and pagination
        instance.get('/change-events', ChangeEventController.getAllChangeEvents);

        // GET /change-events/stats - Get change event statistics
        instance.get('/change-events/stats', ChangeEventController.getChangeEventStats);

        // GET /change-events/:id - Get change event by ID
        instance.get('/change-events/:id', ChangeEventController.getChangeEventById);

        // PUT /change-events/:id - Update change event
        instance.put('/change-events/:id', ChangeEventController.updateChangeEvent);

        // DELETE /change-events/:id - Delete change event
        instance.delete('/change-events/:id', ChangeEventController.deleteChangeEvent);
    });
}