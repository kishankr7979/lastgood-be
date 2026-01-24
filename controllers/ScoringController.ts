import { FastifyRequest, FastifyReply } from 'fastify';
import { ChangeEventModel, ChangeEventFilters } from '../models/ChangeEvent';
import { ScoringEngine, IncidentContext } from '../services/ScoringEngine';

interface ScoringQuery {
    incidentAt: string;
    service?: string;
    environment?: string;
    severity?: 'critical' | 'high' | 'medium' | 'low';
    description?: string;
    window?: string;
    limit?: string;
}

export class ScoringController {
    static async scoreIncident(
        request: FastifyRequest<{ Querystring: ScoringQuery }>,
        reply: FastifyReply
    ) {
        try {
            const {
                incidentAt,
                service,
                environment,
                severity = 'medium',
                description,
                window = '2h',
                limit
            } = request.query;

            // Validate required parameters
            if (!incidentAt) {
                return reply.code(400).send({
                    success: false,
                    message: 'incidentAt parameter is required (ISO 8601 format)'
                });
            }

            const incidentDate = new Date(incidentAt);
            if (isNaN(incidentDate.getTime())) {
                return reply.code(400).send({
                    success: false,
                    message: 'Invalid incidentAt format. Use ISO 8601 format'
                });
            }

            // Parse time window
            const windowMs = ScoringController.parseTimeWindow(window);
            if (windowMs === null) {
                return reply.code(400).send({
                    success: false,
                    message: 'Invalid window format. Use format like "30m", "2h", "1d"'
                });
            }

            const startTime = new Date(incidentDate.getTime() - windowMs);

            // Build context
            const context: IncidentContext = {
                incidentAt: incidentDate,
                service,
                environment,
                severity,
                description
            };

            // Get relevant change events
            const filters: ChangeEventFilters = {
                from_date: startTime,
                to_date: incidentDate,
            };

            if (service) filters.service = service;
            if (environment) filters.environment = environment;

            if (limit) {
                const limitNum = parseInt(limit);
                if (!isNaN(limitNum) && limitNum > 0 && limitNum <= 1000) {
                    filters.limit = limitNum;
                }
            }

            const changeEventModel = new ChangeEventModel(request.server);
            const events = await changeEventModel.getAll(filters);

            // Score the events
            const scoringResult = ScoringEngine.scoreMultipleEvents(events, context);

            return reply.code(200).send({
                success: true,
                data: {
                    incident: {
                        occurred_at: incidentAt,
                        service: service || 'unknown',
                        environment: environment || 'unknown',
                        severity,
                        description: description || 'No description provided'
                    },
                    analysis_window: {
                        from: startTime.toISOString(),
                        to: incidentDate.toISOString(),
                        duration: window
                    },
                    overall_assessment: scoringResult.overallScore,
                    individual_scores: scoringResult.individualScores.map(item => ({
                        event: {
                            id: item.event.id,
                            occurred_at: item.event.occurred_at,
                            service: item.event.service,
                            environment: item.event.environment,
                            type: item.event.type,
                            source: item.event.source,
                            summary: item.event.summary,
                            meta: item.event.meta
                        },
                        risk_assessment: item.score
                    })),
                    correlations: scoringResult.correlations,
                    summary: {
                        total_events_analyzed: events.length,
                        high_risk_events: scoringResult.individualScores.filter(s => s.score.score >= 60).length,
                        critical_risk_events: scoringResult.individualScores.filter(s => s.score.score >= 80).length,
                        correlations_found: scoringResult.correlations.length
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

    static async scoreEvent(
        request: FastifyRequest<{
            Params: { id: string };
            Querystring: Omit<ScoringQuery, 'window' | 'limit'>;
        }>,
        reply: FastifyReply
    ) {
        try {
            const { id } = request.params;
            const { incidentAt, service, environment, severity = 'medium', description } = request.query;

            // Validate UUID
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(id)) {
                return reply.code(400).send({
                    success: false,
                    message: 'Invalid UUID format'
                });
            }

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

            const changeEventModel = new ChangeEventModel(request.server);
            const event = await changeEventModel.getById(id);

            if (!event) {
                return reply.code(404).send({
                    success: false,
                    message: 'Change event not found'
                });
            }

            // Build context
            const context: IncidentContext = {
                incidentAt: incidentDate,
                service,
                environment,
                severity,
                description
            };

            // Get related events for context (same service, within 24 hours)
            const oneDayBefore = new Date(incidentDate.getTime() - 24 * 60 * 60 * 1000);
            const relatedEvents = await changeEventModel.getAll({
                service: event.service,
                from_date: oneDayBefore,
                to_date: incidentDate
            });

            // Score the specific event
            const scoreResult = ScoringEngine.scoreChangeEvent(event, context, relatedEvents);

            return reply.code(200).send({
                success: true,
                data: {
                    event: {
                        id: event.id,
                        occurred_at: event.occurred_at,
                        service: event.service,
                        environment: event.environment,
                        type: event.type,
                        source: event.source,
                        summary: event.summary,
                        meta: event.meta
                    },
                    incident_context: {
                        occurred_at: incidentAt,
                        service: service || 'unknown',
                        environment: environment || 'unknown',
                        severity,
                        description: description || 'No description provided'
                    },
                    risk_assessment: scoreResult,
                    related_context: {
                        total_related_events: relatedEvents.length,
                        analysis_period: '24 hours before incident'
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

    static async explainScoring(request: FastifyRequest, reply: FastifyReply) {
        try {
            return reply.code(200).send({
                success: true,
                data: {
                    scoring_methodology: {
                        description: 'Multi-factor risk assessment for change events in relation to incidents',
                        factors: [
                            {
                                name: 'Timing Proximity',
                                weight: '30%',
                                description: 'How close in time the change occurred to the incident',
                                scoring: {
                                    '0-5 minutes': '100 points - Extremely high correlation risk',
                                    '5-15 minutes': '85 points - Very high correlation risk',
                                    '15-30 minutes': '70 points - High correlation risk',
                                    '30-60 minutes': '50 points - Moderate correlation risk',
                                    '1-2 hours': '30 points - Low correlation risk',
                                    '2+ hours': '10 points - Minimal correlation risk'
                                }
                            },
                            {
                                name: 'Event Type Risk',
                                weight: '25%',
                                description: 'Inherent risk level of the type of change',
                                scoring: {
                                    'migration': '85 points - Database changes are high risk',
                                    'hotfix': '80 points - Emergency fixes often bypass testing',
                                    'infrastructure': '75 points - Infrastructure changes affect stability',
                                    'deployment': '70 points - Code changes can introduce bugs',
                                    'config-change': '60 points - Configuration changes can break systems',
                                    'feature-flag': '50 points - Feature toggles have moderate risk',
                                    'scaling': '45 points - Scaling operations can cause issues',
                                    'rollback': '40 points - Rollbacks can introduce new problems',
                                    'maintenance': '30 points - Maintenance typically low risk'
                                }
                            },
                            {
                                name: 'Service Criticality',
                                weight: '20%',
                                description: 'How critical the affected service is to system operation',
                                scoring: {
                                    'Same as incident service': '90 points - Direct correlation',
                                    'Payment/Billing services': '90 points - Business critical',
                                    'Authentication services': '85 points - Affects all users',
                                    'Database services': '85 points - Affects multiple services',
                                    'API/Gateway services': '80 points - Critical for functionality',
                                    'Web/Frontend services': '60 points - User-facing but lower impact',
                                    'Other services': '50 points - Standard risk level'
                                }
                            },
                            {
                                name: 'Change Frequency',
                                weight: '15%',
                                description: 'How frequently changes occur to this service',
                                scoring: {
                                    '7+ changes/day': '70 points - Very high frequency indicates instability',
                                    '4-6 changes/day': '40 points - High frequency increases risk',
                                    '2-3 changes/day': '20 points - Normal frequency',
                                    '0-1 changes/day': '30 points - Unusual activity may indicate risk'
                                }
                            },
                            {
                                name: 'Blast Radius',
                                weight: '10%',
                                description: 'Potential scope of impact from the change',
                                scoring: {
                                    'Single service': '20 points - Isolated impact',
                                    '2-3 services': '50 points - Multiple services affected',
                                    '4+ services': '80 points - Wide-reaching impact',
                                    'Breaking changes': '+25 points - Compatibility issues',
                                    'Affects all users': '+20 points - User-wide impact',
                                    'Database migration': '+15 points - Data layer impact'
                                }
                            }
                        ],
                        environment_multipliers: {
                            'production': '1.0x - Full risk weight',
                            'staging': '0.7x - Reduced risk weight',
                            'development': '0.3x - Low risk weight',
                            'test': '0.2x - Minimal risk weight'
                        },
                        risk_levels: {
                            'critical': '80-100 points - Immediate investigation required',
                            'high': '60-79 points - High priority investigation',
                            'medium': '40-59 points - Should be reviewed',
                            'low': '0-39 points - Low correlation likelihood'
                        },
                        correlations: {
                            description: 'Additional risk from multiple related changes',
                            types: [
                                'Multiple deployments in sequence (+10 points each)',
                                'Migration + deployment combination (+25 points)',
                                'Cross-service changes (+5 points per additional service)'
                            ]
                        }
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

    private static parseTimeWindow(window: string): number | null {
        const match = window.match(/^(\d+)([mhd])$/);
        if (!match) return null;

        const value = parseInt(match[1]);
        const unit = match[2];

        switch (unit) {
            case 'm': return value * 60 * 1000;
            case 'h': return value * 60 * 60 * 1000;
            case 'd': return value * 24 * 60 * 60 * 1000;
            default: return null;
        }
    }
}