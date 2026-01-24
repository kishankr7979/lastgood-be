import { FastifyRequest, FastifyReply } from 'fastify';
import { OrganizationModel, CreateOrganizationData, UpdateOrganizationData, OrganizationFilters } from '../models/Organization';
import { ApiKeyModel } from '../models/ApiKey';

export class OrganizationController {
    static async getAllOrganizations(
        request: FastifyRequest<{
            Querystring: {
                plan?: string;
                name_search?: string;
                limit?: string;
                offset?: string;
            }
        }>,
        reply: FastifyReply
    ) {
        try {
            const filters: OrganizationFilters = {};

            // Parse query parameters
            if (request.query.plan) filters.plan = request.query.plan;
            if (request.query.name_search) filters.name_search = request.query.name_search;

            if (request.query.limit) {
                const limit = parseInt(request.query.limit);
                if (isNaN(limit) || limit < 1 || limit > 1000) {
                    return reply.code(400).send({
                        success: false,
                        message: 'Limit must be a number between 1 and 1000'
                    });
                }
                filters.limit = limit;
            }

            if (request.query.offset) {
                const offset = parseInt(request.query.offset);
                if (isNaN(offset) || offset < 0) {
                    return reply.code(400).send({
                        success: false,
                        message: 'Offset must be a non-negative number'
                    });
                }
                filters.offset = offset;
            }

            const organizationModel = new OrganizationModel(request.server);
            const [organizations, totalCount] = await Promise.all([
                organizationModel.getAll(filters),
                organizationModel.count(filters)
            ]);

            return reply.code(200).send({
                success: true,
                data: organizations,
                pagination: {
                    total: totalCount,
                    count: organizations.length,
                    limit: filters.limit || null,
                    offset: filters.offset || 0
                }
            });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    static async getOrganizationById(
        request: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply
    ) {
        try {
            const { id } = request.params;

            // Basic UUID validation
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(id)) {
                return reply.code(400).send({
                    success: false,
                    message: 'Invalid UUID format'
                });
            }

            const organizationModel = new OrganizationModel(request.server);
            const organization = await organizationModel.getById(id);

            if (!organization) {
                return reply.code(404).send({
                    success: false,
                    message: 'Organization not found'
                });
            }

            return reply.code(200).send({
                success: true,
                data: organization
            });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    static async getOrganizationBySlug(
        request: FastifyRequest<{ Params: { slug: string } }>,
        reply: FastifyReply
    ) {
        try {
            const { slug } = request.params;

            // Validate slug format
            const slugRegex = /^[a-z0-9-]+$/;
            if (!slugRegex.test(slug)) {
                return reply.code(400).send({
                    success: false,
                    message: 'Invalid slug format. Must contain only lowercase letters, numbers, and hyphens.'
                });
            }

            const organizationModel = new OrganizationModel(request.server);
            const organization = await organizationModel.getBySlug(slug);

            if (!organization) {
                return reply.code(404).send({
                    success: false,
                    message: 'Organization not found'
                });
            }

            return reply.code(200).send({
                success: true,
                data: organization
            });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    static async getOrganizationByAPIKey(request: FastifyRequest, reply: FastifyReply) {

        const id = request.organization_id;

        if (!id) {
            return reply.code(400).send({
                success: false,
                message: 'Organization ID is required'
            });
        }

        try {
            const organizationModel = new OrganizationModel(request.server);
            const organization = await organizationModel.getById(id);

            if (!organization) {
                return reply.code(404).send({
                    success: false,
                    message: 'Organization not found'
                });
            }

            return reply.code(200).send({
                success: true,
                data: organization
            });
        }
        catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                success: false,
                message: 'Internal server error'
            });
        }

    }

    static async createOrganization(
        request: FastifyRequest<{ Body: CreateOrganizationData }>,
        reply: FastifyReply
    ) {
        try {
            const { name, slug, plan } = request.body;

            // Validate required fields
            if (!name || name.trim().length === 0) {
                return reply.code(400).send({
                    success: false,
                    message: 'Organization name is required'
                });
            }

            const id = crypto.randomUUID()


            console.log({ id, name, slug, plan })

            // Validate name length
            if (name.length > 255) {
                return reply.code(400).send({
                    success: false,
                    message: 'Organization name must be 255 characters or less'
                });
            }

            // Validate UUID if provided
            if (id) {
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                if (!uuidRegex.test(id)) {
                    return reply.code(400).send({
                        success: false,
                        message: 'Invalid UUID format'
                    });
                }
            }

            // Validate slug if provided
            if (slug) {
                const slugRegex = /^[a-z0-9-]+$/;
                if (!slugRegex.test(slug)) {
                    return reply.code(400).send({
                        success: false,
                        message: 'Invalid slug format. Must contain only lowercase letters, numbers, and hyphens.'
                    });
                }
            }

            // Validate plan if provided
            if (plan && !['free', 'starter', 'pro', 'enterprise'].includes(plan)) {
                return reply.code(400).send({
                    success: false,
                    message: 'Invalid plan. Must be one of: free, starter, pro, enterprise'
                });
            }

            const organizationModel = new OrganizationModel(request.server);

            // Check if ID already exists (if provided)
            if (id) {
                const existingOrg = await organizationModel.getById(id);
                if (existingOrg) {
                    return reply.code(409).send({
                        success: false,
                        message: 'Organization with this ID already exists'
                    });
                }
            }

            // Check if slug already exists (if provided)
            if (slug) {
                const existingOrg = await organizationModel.getBySlug(slug);
                if (existingOrg) {
                    return reply.code(409).send({
                        success: false,
                        message: 'Organization with this slug already exists'
                    });
                }
            }



            const newOrganization = await organizationModel.create({
                id,
                name: name.trim(),
                slug,
                plan: plan || 'free'
            });

            // Create default API key for the new organization
            const apiKeyModel = new ApiKeyModel(request.server);
            const defaultApiKey = await apiKeyModel.createDefaultKey(
                newOrganization.id,
                newOrganization.name
            );

            return reply.code(201).send({
                success: true,
                data: {
                    organization: newOrganization,
                    default_api_key: {
                        id: defaultApiKey.id,
                        name: defaultApiKey.name,
                        api_key: defaultApiKey.api_key, // Plain text key - only shown once!
                        created_at: defaultApiKey.created_at
                    }
                },
                warning: 'This is the only time the API key will be shown. Please store it securely.'
            });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    static async updateOrganization(
        request: FastifyRequest<{
            Params: { id: string };
            Body: UpdateOrganizationData
        }>,
        reply: FastifyReply
    ) {
        try {
            const { id } = request.params;

            // Basic UUID validation
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(id)) {
                return reply.code(400).send({
                    success: false,
                    message: 'Invalid UUID format'
                });
            }

            const updateData = request.body;

            // Validate name if provided
            if (updateData.name !== undefined) {
                if (!updateData.name || updateData.name.trim().length === 0) {
                    return reply.code(400).send({
                        success: false,
                        message: 'Organization name cannot be empty'
                    });
                }
                if (updateData.name.length > 255) {
                    return reply.code(400).send({
                        success: false,
                        message: 'Organization name must be 255 characters or less'
                    });
                }
                updateData.name = updateData.name.trim();
            }

            // Validate slug if provided
            if (updateData.slug !== undefined) {
                if (updateData.slug) {
                    const slugRegex = /^[a-z0-9-]+$/;
                    if (!slugRegex.test(updateData.slug)) {
                        return reply.code(400).send({
                            success: false,
                            message: 'Invalid slug format. Must contain only lowercase letters, numbers, and hyphens.'
                        });
                    }
                }
            }

            // Validate plan if provided
            if (updateData.plan && !['free', 'starter', 'pro', 'enterprise'].includes(updateData.plan)) {
                return reply.code(400).send({
                    success: false,
                    message: 'Invalid plan. Must be one of: free, starter, pro, enterprise'
                });
            }

            const organizationModel = new OrganizationModel(request.server);

            // Check if slug already exists (if updating slug)
            if (updateData.slug) {
                const existingOrg = await organizationModel.getBySlug(updateData.slug);
                if (existingOrg && existingOrg.id !== id) {
                    return reply.code(409).send({
                        success: false,
                        message: 'Organization with this slug already exists'
                    });
                }
            }

            const updatedOrganization = await organizationModel.update(id, updateData);

            if (!updatedOrganization) {
                return reply.code(404).send({
                    success: false,
                    message: 'Organization not found'
                });
            }

            return reply.code(200).send({
                success: true,
                data: updatedOrganization
            });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    static async deleteOrganization(
        request: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply
    ) {
        try {
            const { id } = request.params;

            // Basic UUID validation
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(id)) {
                return reply.code(400).send({
                    success: false,
                    message: 'Invalid UUID format'
                });
            }

            const organizationModel = new OrganizationModel(request.server);
            const deleted = await organizationModel.delete(id);

            if (!deleted) {
                return reply.code(404).send({
                    success: false,
                    message: 'Organization not found'
                });
            }

            return reply.code(200).send({
                success: true,
                message: 'Organization deleted successfully'
            });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    static async getOrganizationStats(request: FastifyRequest, reply: FastifyReply) {
        try {
            const organizationModel = new OrganizationModel(request.server);
            const stats = await organizationModel.getStats();

            return reply.code(200).send({
                success: true,
                data: stats
            });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                success: false,
                message: 'Internal server error'
            });
        }
    }
}