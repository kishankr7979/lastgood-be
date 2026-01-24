import { FastifyInstance } from 'fastify';
import { OrganizationController } from '../controllers/OrganizationController';
import { authenticateJWT } from '../middleware/auth';


export default async function organizationRoutes(fastify: FastifyInstance) {

    // Add JWT authentication middleware to all routes
    fastify.addHook('preHandler', authenticateJWT);

    // POST /organizations - Create new organization
    fastify.post('/organizations', OrganizationController.createOrganization);

    // GET /organizations - Get all organizations with filtering and pagination
    fastify.get('/organizations', OrganizationController.getAllOrganizations);

    // GET /organizations/stats - Get organization statistics
    fastify.get('/organizations/stats', OrganizationController.getOrganizationStats);

    fastify.get('/organization', OrganizationController.getOrganizationByAPIKey);

    // GET /organizations/:id - Get organization by ID
    fastify.get('/organizations/:id', OrganizationController.getOrganizationById);

    // GET /organizations/slug/:slug - Get organization by slug
    fastify.get('/organizations/slug/:slug', OrganizationController.getOrganizationBySlug);


    // PUT /organizations/:id - Update organization
    fastify.put('/organizations/:id', OrganizationController.updateOrganization);

    // DELETE /organizations/:id - Delete organization
    fastify.delete('/organizations/:id', OrganizationController.deleteOrganization);
}