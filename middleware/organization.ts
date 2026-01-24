import { FastifyRequest, FastifyReply } from 'fastify';
import { OrganizationModel, Organization } from '../models/Organization';

// Extend FastifyRequest to include organization data
declare module 'fastify' {
    interface FastifyRequest {
        getOrganizationId(): string;
        getOrganization(): Promise<Organization | null>;
        requireOrganization(): Promise<Organization>;
    }
}

export interface OrganizationContext {
    organizationId: string;
    organization?: Organization;
}

// Middleware to add organization helper methods to authenticated requests
export async function addOrganizationHelpers(
    request: FastifyRequest,
    reply: FastifyReply
) {
    // Add helper method to get organization ID
    request.getOrganizationId = function (): string {
        if (!this.organization_id) {
            throw new Error('Request is not authenticated or organization_id is missing');
        }
        return this.organization_id;
    };

    // Add helper method to get full organization data (cached)
    let cachedOrganization: Organization | null = null;

    request.getOrganization = async function (): Promise<Organization | null> {
        if (!this.organization_id) {
            return null;
        }

        // Return cached organization if already loaded
        if (cachedOrganization) {
            return cachedOrganization;
        }

        try {
            const organizationModel = new OrganizationModel(this.server);
            cachedOrganization = await organizationModel.getById(this.organization_id);
            return cachedOrganization;
        } catch (error) {
            this.log.error('Failed to load organization:', error);
            return null;
        }
    };

    // Add helper method that requires organization (throws if not found)
    request.requireOrganization = async function (): Promise<Organization> {
        const organization = await this.getOrganization();

        if (!organization) {
            throw new Error('Organization not found or request not authenticated');
        }

        return organization;
    };
}

// Helper function to get organization context from request
export function getOrganizationContext(request: FastifyRequest): OrganizationContext {
    const organizationId = request.getOrganizationId();

    return {
        organizationId
    };
}

// Middleware to ensure organization exists and is accessible
export async function validateOrganization(
    request: FastifyRequest,
    reply: FastifyReply
) {
    try {
        const organization = await request.getOrganization();

        if (!organization) {
            return reply.code(404).send({
                success: false,
                message: 'Organization not found'
            });
        }

        // You can add additional organization validation here
        // For example, check if organization is active, not suspended, etc.

    } catch (error) {
        request.log.error('Organization validation error:', error);
        return reply.code(500).send({
            success: false,
            message: 'Failed to validate organization'
        });
    }
}

// Middleware to check organization plan permissions
export function requirePlan(allowedPlans: string[]) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
        try {
            const organization = await request.requireOrganization();

            if (!allowedPlans.includes(organization.plan)) {
                return reply.code(403).send({
                    success: false,
                    message: `This feature requires one of the following plans: ${allowedPlans.join(', ')}. Current plan: ${organization.plan}`,
                    upgrade_required: true,
                    current_plan: organization.plan,
                    required_plans: allowedPlans
                });
            }
        } catch (error) {
            request.log.error('Plan validation error:', error);
            return reply.code(500).send({
                success: false,
                message: 'Failed to validate organization plan'
            });
        }
    };
}

// Middleware to add organization info to response headers (for debugging)
export async function addOrganizationHeaders(
    request: FastifyRequest,
    reply: FastifyReply
) {
    try {
        const organizationId = request.getOrganizationId();
        const organization = await request.getOrganization();

        reply.header('X-Organization-Id', organizationId);

        if (organization) {
            reply.header('X-Organization-Name', organization.name);
            reply.header('X-Organization-Plan', organization.plan);

            if (organization.slug) {
                reply.header('X-Organization-Slug', organization.slug);
            }
        }
    } catch (error) {
        // Don't fail the request if we can't add headers
        request.log.warn('Failed to add organization headers:', error);
    }
}