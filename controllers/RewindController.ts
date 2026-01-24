import { FastifyRequest, FastifyReply } from 'fastify';
import { ChangeEventModel, ChangeEventFilters } from '../models/ChangeEvent';

interface RewindQuery {
    service?: string;
    environment?: string;
    incidentAt: string;
    window?: string;
    limit?: string;
}

export class RewindController {
    static async rewindEvents(
        request: FastifyRequest<{ Querystring: RewindQuery }>,
        reply: FastifyReply
    ) {
        try {
            const { service, environment, incidentAt, window = '30m', limit } = request.query;

            // Validate required incidentAt parameter
            if (!incidentAt) {
                return reply.code(400).send({
                    success: false,
                    message: 'incidentAt parameter is required (ISO 8601 format)'
                });
            }

            // Parse incident timestamp
            const incidentDate = new Date(incidentAt);
            if (isNaN(incidentDate.getTime())) {
                return reply.code(400).send({
                    success: false,
                    message: 'Invalid incidentAt format. Use ISO 8601 format (e.g., 2026-01-18T14:32:00Z)'
                });
            }

            // Parse time window
            const windowMs = RewindController.parseTimeWindow(window);
            if (windowMs === null) {
                return reply.code(400).send({
                    success: false,
                    message: 'Invalid window format. Use format like "30m", "2h", "1d" (m=minutes, h=hours, d=days)'
                });
            }

            // Calculate the start time (incident time minus window)
            const startTime = new Date(incidentDate.getTime() - windowMs);

            // Build filters for change events
            const filters: ChangeEventFilters = {
                from_date: startTime,
                to_date: incidentDate,
            };

            if (service) filters.service = service;
            if (environment) filters.environment = environment;

            if (limit) {
                const limitNum = parseInt(limit);
                if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
                    return reply.code(400).send({
                        success: false,
                        message: 'Limit must be a number between 1 and 1000'
                    });
                }
                filters.limit = limitNum;
            }

            filters.organization_id = request.organization_id

            const changeEventModel = new ChangeEventModel(request.server);
            const events = await changeEventModel.getAll(filters);

            // Group events by service and type for better analysis
            const eventsByService = RewindController.groupEventsByService(events);
            const eventsByType = RewindController.groupEventsByType(events);

            // Calculate time differences from incident
            const eventsWithTimeDiff = events.map(event => ({
                ...event,
                time_before_incident: RewindController.formatTimeDifference(
                    incidentDate.getTime() - new Date(event.occurred_at).getTime()
                )
            }));

            return reply.code(200).send({
                success: true,
                data: {
                    incident_at: incidentAt,
                    window: window,
                    time_range: {
                        from: startTime.toISOString(),
                        to: incidentDate.toISOString()
                    },
                    filters: {
                        service: service || null,
                        environment: environment || null
                    },
                    events: eventsWithTimeDiff,
                    summary: {
                        total_events: events.length,
                        events_by_service: eventsByService,
                        events_by_type: eventsByType,
                        most_recent_event: events.length > 0 ? events[0] : null
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

    static async rewindSummary(
        request: FastifyRequest<{ Querystring: RewindQuery }>,
        reply: FastifyReply
    ) {
        try {
            const { service, environment, incidentAt, window = '30m' } = request.query;

            if (!incidentAt) {
                return reply.code(400).send({
                    success: false,
                    message: 'incidentAt parameter is required'
                });
            }

            const incidentDate = new Date(incidentAt);
            if (isNaN(incidentDate.getTime())) {
                return reply.code(400).send({
                    success: false,
                    message: 'Invalid incidentAt format'
                });
            }

            const windowMs = RewindController.parseTimeWindow(window);
            if (windowMs === null) {
                return reply.code(400).send({
                    success: false,
                    message: 'Invalid window format'
                });
            }

            const startTime = new Date(incidentDate.getTime() - windowMs);

            const filters: ChangeEventFilters = {
                from_date: startTime,
                to_date: incidentDate,
            };

            if (service) filters.service = service;
            if (environment) filters.environment = environment;

            const changeEventModel = new ChangeEventModel(request.server);
            const [events, totalCount] = await Promise.all([
                changeEventModel.getAll(filters),
                changeEventModel.count(filters)
            ]);

            // Risk assessment based on event types and timing
            const riskAssessment = RewindController.assessRisk(events, incidentDate);

            return reply.code(200).send({
                success: true,
                data: {
                    incident_at: incidentAt,
                    window: window,
                    total_events: totalCount,
                    risk_assessment: riskAssessment,
                    recent_deployments: events.filter(e => e.type === 'deployment').length,
                    recent_migrations: events.filter(e => e.type === 'migration').length,
                    services_affected: [...new Set(events.map(e => e.service))],
                    environments_affected: [...new Set(events.map(e => e.environment))]
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

    // Helper method to parse time window strings like "30m", "2h", "1d"
    private static parseTimeWindow(window: string): number | null {
        const match = window.match(/^(\d+)([mhd])$/);
        if (!match) return null;

        const value = parseInt(match[1]);
        const unit = match[2];

        switch (unit) {
            case 'm': return value * 60 * 1000; // minutes to milliseconds
            case 'h': return value * 60 * 60 * 1000; // hours to milliseconds
            case 'd': return value * 24 * 60 * 60 * 1000; // days to milliseconds
            default: return null;
        }
    }

    // Helper method to group events by service
    private static groupEventsByService(events: any[]) {
        return events.reduce((acc, event) => {
            acc[event.service] = (acc[event.service] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    }

    // Helper method to group events by type
    private static groupEventsByType(events: any[]) {
        return events.reduce((acc, event) => {
            acc[event.type] = (acc[event.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    }

    // Helper method to format time difference in human readable format
    private static formatTimeDifference(ms: number): string {
        const minutes = Math.floor(ms / (1000 * 60));
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h ago`;
        if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
        return `${minutes}m ago`;
    }

    // Helper method to assess risk based on events
    private static assessRisk(events: any[], incidentDate: Date) {
        if (events.length === 0) {
            return {
                level: 'low',
                score: 0,
                factors: ['No recent changes detected']
            };
        }

        let riskScore = 0;
        const factors: string[] = [];

        // Recent deployments increase risk
        const recentDeployments = events.filter(e => e.type === 'deployment');
        if (recentDeployments.length > 0) {
            riskScore += recentDeployments.length * 20;
            factors.push(`${recentDeployments.length} recent deployment(s)`);
        }

        // Database migrations are high risk
        const migrations = events.filter(e => e.type === 'migration');
        if (migrations.length > 0) {
            riskScore += migrations.length * 30;
            factors.push(`${migrations.length} database migration(s)`);
        }

        // Events very close to incident time are higher risk
        const veryRecentEvents = events.filter(e => {
            const timeDiff = incidentDate.getTime() - new Date(e.occurred_at).getTime();
            return timeDiff < 10 * 60 * 1000; // within 10 minutes
        });

        if (veryRecentEvents.length > 0) {
            riskScore += veryRecentEvents.length * 25;
            factors.push(`${veryRecentEvents.length} change(s) within 10 minutes of incident`);
        }

        // Multiple services affected
        const uniqueServices = new Set(events.map(e => e.service));
        if (uniqueServices.size > 2) {
            riskScore += 15;
            factors.push(`Multiple services affected (${uniqueServices.size})`);
        }

        let level: string;
        if (riskScore >= 80) level = 'critical';
        else if (riskScore >= 50) level = 'high';
        else if (riskScore >= 25) level = 'medium';
        else level = 'low';

        return {
            level,
            score: Math.min(riskScore, 100),
            factors
        };
    }
}