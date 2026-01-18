import { FastifyRequest, FastifyReply } from 'fastify';
import { ChangeEventModel, CreateChangeEventData, UpdateChangeEventData, ChangeEventFilters } from '../models/ChangeEvent';

export class ChangeEventController {
    static async getAllChangeEvents(
        request: FastifyRequest<{
            Querystring: {
                service?: string;
                environment?: string;
                type?: string;
                source?: string;
                from_date?: string;
                to_date?: string;
                limit?: string;
                offset?: string;
            }
        }>,
        reply: FastifyReply
    ) {
        try {
            const filters: ChangeEventFilters = {};

            // Parse query parameters
            if (request.query.service) filters.service = request.query.service;
            if (request.query.environment) filters.environment = request.query.environment;
            if (request.query.type) filters.type = request.query.type;
            if (request.query.source) filters.source = request.query.source;

            if (request.query.from_date) {
                filters.from_date = new Date(request.query.from_date);
                if (isNaN(filters.from_date.getTime())) {
                    return reply.code(400).send({
                        success: false,
                        message: 'Invalid from_date format. Use ISO 8601 format.'
                    });
                }
            }

            if (request.query.to_date) {
                filters.to_date = new Date(request.query.to_date);
                if (isNaN(filters.to_date.getTime())) {
                    return reply.code(400).send({
                        success: false,
                        message: 'Invalid to_date format. Use ISO 8601 format.'
                    });
                }
            }

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

            const changeEventModel = new ChangeEventModel(request.server);
            const [events, totalCount] = await Promise.all([
                changeEventModel.getAll(filters),
                changeEventModel.count(filters)
            ]);

            return reply.code(200).send({
                success: true,
                data: events,
                pagination: {
                    total: totalCount,
                    count: events.length,
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

    static async getChangeEventById(
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

            const changeEventModel = new ChangeEventModel(request.server);
            const event = await changeEventModel.getById(id);

            if (!event) {
                return reply.code(404).send({
                    success: false,
                    message: 'Change event not found'
                });
            }

            return reply.code(200).send({
                success: true,
                data: event
            });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    static async createChangeEvent(
        request: FastifyRequest<{ Body: CreateChangeEventData }>,
        reply: FastifyReply
    ) {
        try {
            const { occurred_at, service, environment, type, source, summary, meta } = request.body;

            const id = crypto.randomUUID();

            // Validate required fields
            if (!occurred_at || !service || !environment || !type || !source || !summary) {
                return reply.code(400).send({
                    success: false,
                    message: 'Missing required fields: occurred_at, service, environment, type, source, summary'
                });
            }

            // Validate occurred_at is a valid date
            const occurredAtDate = new Date(occurred_at);
            if (isNaN(occurredAtDate.getTime())) {
                return reply.code(400).send({
                    success: false,
                    message: 'Invalid occurred_at date format. Use ISO 8601 format.'
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

            const changeEventModel = new ChangeEventModel(request.server);

            // Check if ID already exists (if provided)
            if (id) {
                const existingEvent = await changeEventModel.getById(id);
                if (existingEvent) {
                    return reply.code(409).send({
                        success: false,
                        message: 'Change event with this ID already exists'
                    });
                }
            }

            const newEvent = await changeEventModel.create({
                id,
                occurred_at: occurredAtDate,
                organization_id: request.organization_id,
                service,
                environment,
                type,
                source,
                summary,
                meta: meta || {}
            });

            return reply.code(201).send({
                success: true,
                data: newEvent
            });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    static async updateChangeEvent(
        request: FastifyRequest<{
            Params: { id: string };
            Body: UpdateChangeEventData
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

            // Validate occurred_at if provided
            if (updateData.occurred_at) {
                const occurredAtDate = new Date(updateData.occurred_at);
                if (isNaN(occurredAtDate.getTime())) {
                    return reply.code(400).send({
                        success: false,
                        message: 'Invalid occurred_at date format. Use ISO 8601 format.'
                    });
                }
                updateData.occurred_at = occurredAtDate;
            }

            const changeEventModel = new ChangeEventModel(request.server);
            const updatedEvent = await changeEventModel.update(id, updateData);

            if (!updatedEvent) {
                return reply.code(404).send({
                    success: false,
                    message: 'Change event not found'
                });
            }

            return reply.code(200).send({
                success: true,
                data: updatedEvent
            });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    static async deleteChangeEvent(
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

            const changeEventModel = new ChangeEventModel(request.server);
            const deleted = await changeEventModel.delete(id);

            if (!deleted) {
                return reply.code(404).send({
                    success: false,
                    message: 'Change event not found'
                });
            }

            return reply.code(200).send({
                success: true,
                message: 'Change event deleted successfully'
            });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    static async getChangeEventStats(request: FastifyRequest, reply: FastifyReply) {
        try {
            const changeEventModel = new ChangeEventModel(request.server);

            const [
                totalEvents,
                services,
                environments,
                types,
                sources
            ] = await Promise.all([
                changeEventModel.count(),
                changeEventModel.getDistinctValues('service'),
                changeEventModel.getDistinctValues('environment'),
                changeEventModel.getDistinctValues('type'),
                changeEventModel.getDistinctValues('source')
            ]);

            return reply.code(200).send({
                success: true,
                data: {
                    totalEvents,
                    distinctValues: {
                        services,
                        environments,
                        types,
                        sources
                    }
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
}