import { ChangeEvent } from '../models/ChangeEvent';

export interface ScoreResult {
    score: number;
    level: 'critical' | 'high' | 'medium' | 'low';
    explanation: string;
    factors: ScoreFactor[];
    recommendations: string[];
}

export interface ScoreFactor {
    name: string;
    score: number;
    weight: number;
    description: string;
    evidence: string[];
}

export interface IncidentContext {
    incidentAt: Date;
    service?: string;
    environment?: string;
    severity?: 'critical' | 'high' | 'medium' | 'low';
    description?: string;
}

export class ScoringEngine {
    private static readonly SCORE_WEIGHTS = {
        TIMING_PROXIMITY: 0.3,      // How close to incident
        EVENT_TYPE_RISK: 0.25,     // Risk level of event type
        SERVICE_CRITICALITY: 0.2,   // How critical the service is
        CHANGE_FREQUENCY: 0.15,     // How often changes happen
        BLAST_RADIUS: 0.1          // Potential impact scope
    };

    private static readonly EVENT_TYPE_SCORES: Record<string, number> = {
        'deployment': 70,
        'migration': 85,
        'config-change': 60,
        'infrastructure': 75,
        'rollback': 40,
        'hotfix': 80,
        'feature-flag': 50,
        'scaling': 45,
        'maintenance': 30
    };

    private static readonly ENVIRONMENT_MULTIPLIERS: Record<string, number> = {
        'prod': 1.0,
        'production': 1.0,
        'staging': 0.7,
        'dev': 0.3,
        'development': 0.3,
        'test': 0.2
    };

    static scoreChangeEvent(
        event: ChangeEvent,
        context: IncidentContext,
        allEvents: ChangeEvent[] = []
    ): ScoreResult {
        const factors: ScoreFactor[] = [];
        let totalScore = 0;

        // 1. Timing Proximity Score
        const timingFactor = this.calculateTimingProximity(event, context);
        factors.push(timingFactor);
        totalScore += timingFactor.score * this.SCORE_WEIGHTS.TIMING_PROXIMITY;

        // 2. Event Type Risk Score
        const typeFactor = this.calculateEventTypeRisk(event);
        factors.push(typeFactor);
        totalScore += typeFactor.score * this.SCORE_WEIGHTS.EVENT_TYPE_RISK;

        // 3. Service Criticality Score
        const serviceFactor = this.calculateServiceCriticality(event, context);
        factors.push(serviceFactor);
        totalScore += serviceFactor.score * this.SCORE_WEIGHTS.SERVICE_CRITICALITY;

        // 4. Change Frequency Score
        const frequencyFactor = this.calculateChangeFrequency(event, allEvents, context);
        factors.push(frequencyFactor);
        totalScore += frequencyFactor.score * this.SCORE_WEIGHTS.CHANGE_FREQUENCY;

        // 5. Blast Radius Score
        const blastRadiusFactor = this.calculateBlastRadius(event, allEvents);
        factors.push(blastRadiusFactor);
        totalScore += blastRadiusFactor.score * this.SCORE_WEIGHTS.BLAST_RADIUS;

        // Apply environment multiplier
        const envMultiplier = this.ENVIRONMENT_MULTIPLIERS[event.environment.toLowerCase()] || 0.5;
        totalScore *= envMultiplier;

        // Normalize score to 0-100
        const finalScore = Math.min(Math.max(totalScore, 0), 100);

        return {
            score: Math.round(finalScore),
            level: this.getScoreLevel(finalScore),
            explanation: this.generateExplanation(event, context, factors, finalScore),
            factors,
            recommendations: this.generateRecommendations(event, context, factors, finalScore)
        };
    }

    static scoreMultipleEvents(
        events: ChangeEvent[],
        context: IncidentContext
    ): {
        overallScore: ScoreResult;
        individualScores: Array<{ event: ChangeEvent; score: ScoreResult }>;
        correlations: Array<{ events: ChangeEvent[]; description: string; riskIncrease: number }>;
    } {
        // Score individual events
        const individualScores = events.map(event => ({
            event,
            score: this.scoreChangeEvent(event, context, events)
        }));

        // Calculate correlations and compound risks
        const correlations = this.findEventCorrelations(events, context);

        // Calculate overall risk score
        const overallScore = this.calculateOverallRisk(individualScores, correlations, context);

        return {
            overallScore,
            individualScores,
            correlations
        };
    }

    private static calculateTimingProximity(event: ChangeEvent, context: IncidentContext): ScoreFactor {
        const timeDiff = context.incidentAt.getTime() - new Date(event.occurred_at).getTime();
        const minutesDiff = timeDiff / (1000 * 60);

        let score = 0;
        let description = '';
        const evidence: string[] = [];

        if (minutesDiff < 0) {
            score = 0;
            description = 'Event occurred after incident';
            evidence.push('Change happened after the incident occurred');
        } else if (minutesDiff <= 5) {
            score = 100;
            description = 'Extremely close timing - very high correlation risk';
            evidence.push(`Change occurred only ${Math.round(minutesDiff)} minutes before incident`);
        } else if (minutesDiff <= 15) {
            score = 85;
            description = 'Very close timing - high correlation risk';
            evidence.push(`Change occurred ${Math.round(minutesDiff)} minutes before incident`);
        } else if (minutesDiff <= 30) {
            score = 70;
            description = 'Close timing - moderate correlation risk';
            evidence.push(`Change occurred ${Math.round(minutesDiff)} minutes before incident`);
        } else if (minutesDiff <= 60) {
            score = 50;
            description = 'Recent timing - some correlation risk';
            evidence.push(`Change occurred ${Math.round(minutesDiff)} minutes before incident`);
        } else if (minutesDiff <= 120) {
            score = 30;
            description = 'Moderately recent - low correlation risk';
            evidence.push(`Change occurred ${Math.round(minutesDiff / 60)} hours before incident`);
        } else {
            score = 10;
            description = 'Distant timing - minimal correlation risk';
            evidence.push(`Change occurred ${Math.round(minutesDiff / 60)} hours before incident`);
        }

        return {
            name: 'Timing Proximity',
            score,
            weight: this.SCORE_WEIGHTS.TIMING_PROXIMITY,
            description,
            evidence
        };
    }

    private static calculateEventTypeRisk(event: ChangeEvent): ScoreFactor {
        const baseScore = this.EVENT_TYPE_SCORES[event.type.toLowerCase()] || 50;
        const evidence: string[] = [];
        let description = '';

        switch (event.type.toLowerCase()) {
            case 'deployment':
                description = 'Code deployments can introduce bugs or breaking changes';
                evidence.push('New code deployment');
                if (event.meta?.rollback_available === false) {
                    evidence.push('No rollback mechanism available');
                }
                break;
            case 'migration':
                description = 'Database migrations are high-risk operations';
                evidence.push('Database schema or data changes');
                evidence.push('Potential for data corruption or performance issues');
                break;
            case 'hotfix':
                description = 'Hotfixes are rushed changes with higher error probability';
                evidence.push('Emergency fix deployed');
                evidence.push('Likely bypassed normal testing procedures');
                break;
            case 'infrastructure':
                description = 'Infrastructure changes can affect system stability';
                evidence.push('Infrastructure or configuration changes');
                break;
            case 'rollback':
                description = 'Rollbacks indicate previous issues and can cause new problems';
                evidence.push('Rollback operation performed');
                break;
            default:
                description = `${event.type} changes carry moderate risk`;
                evidence.push(`${event.type} operation performed`);
        }

        return {
            name: 'Event Type Risk',
            score: baseScore,
            weight: this.SCORE_WEIGHTS.EVENT_TYPE_RISK,
            description,
            evidence
        };
    }

    private static calculateServiceCriticality(event: ChangeEvent, context: IncidentContext): ScoreFactor {
        let score = 50; // Default score
        const evidence: string[] = [];
        let description = '';

        // Check if it's the same service as the incident
        if (context.service && event.service === context.service) {
            score = 90;
            description = 'Change to the same service experiencing the incident';
            evidence.push(`Direct change to affected service: ${event.service}`);
        } else {
            // Infer criticality from service name patterns
            const serviceName = event.service.toLowerCase();

            if (serviceName.includes('api') || serviceName.includes('gateway')) {
                score = 80;
                description = 'Change to critical API service';
                evidence.push('API services are typically critical for system functionality');
            } else if (serviceName.includes('auth') || serviceName.includes('login')) {
                score = 85;
                description = 'Change to authentication service';
                evidence.push('Authentication services affect all user access');
            } else if (serviceName.includes('payment') || serviceName.includes('billing')) {
                score = 90;
                description = 'Change to payment/billing service';
                evidence.push('Payment services are business-critical');
            } else if (serviceName.includes('database') || serviceName.includes('db')) {
                score = 85;
                description = 'Change to database service';
                evidence.push('Database changes can affect multiple dependent services');
            } else if (serviceName.includes('web') || serviceName.includes('frontend')) {
                score = 60;
                description = 'Change to web/frontend service';
                evidence.push('Frontend changes typically have lower system impact');
            } else {
                score = 50;
                description = 'Change to standard service';
                evidence.push('Service criticality not determined from name');
            }
        }

        return {
            name: 'Service Criticality',
            score,
            weight: this.SCORE_WEIGHTS.SERVICE_CRITICALITY,
            description,
            evidence
        };
    }

    private static calculateChangeFrequency(
        event: ChangeEvent,
        allEvents: ChangeEvent[],
        context: IncidentContext
    ): ScoreFactor {
        // Look at changes to the same service in the past 24 hours
        const oneDayAgo = new Date(context.incidentAt.getTime() - 24 * 60 * 60 * 1000);
        const recentChanges = allEvents.filter(e =>
            e.service === event.service &&
            new Date(e.occurred_at) >= oneDayAgo &&
            new Date(e.occurred_at) <= context.incidentAt
        );

        let score = 0;
        let description = '';
        const evidence: string[] = [];

        if (recentChanges.length <= 1) {
            score = 30;
            description = 'Infrequent changes - unusual activity';
            evidence.push('Very few recent changes to this service');
            evidence.push('Unusual change activity may indicate higher risk');
        } else if (recentChanges.length <= 3) {
            score = 20;
            description = 'Normal change frequency';
            evidence.push(`${recentChanges.length} changes in past 24 hours`);
        } else if (recentChanges.length <= 6) {
            score = 40;
            description = 'High change frequency - increased risk';
            evidence.push(`${recentChanges.length} changes in past 24 hours`);
            evidence.push('High change frequency increases chance of issues');
        } else {
            score = 70;
            description = 'Very high change frequency - significant risk';
            evidence.push(`${recentChanges.length} changes in past 24 hours`);
            evidence.push('Extremely high change rate indicates instability');
        }

        return {
            name: 'Change Frequency',
            score,
            weight: this.SCORE_WEIGHTS.CHANGE_FREQUENCY,
            description,
            evidence
        };
    }

    private static calculateBlastRadius(event: ChangeEvent, allEvents: ChangeEvent[]): ScoreFactor {
        let score = 30; // Default score
        const evidence: string[] = [];
        let description = '';

        // Check for simultaneous changes across multiple services
        const eventTime = new Date(event.occurred_at);
        const timeWindow = 10 * 60 * 1000; // 10 minutes

        const simultaneousChanges = allEvents.filter(e => {
            const eTime = new Date(e.occurred_at);
            return Math.abs(eTime.getTime() - eventTime.getTime()) <= timeWindow && e.id !== event.id;
        });

        const affectedServices = new Set(simultaneousChanges.map(e => e.service));
        affectedServices.add(event.service);

        if (affectedServices.size === 1) {
            score = 20;
            description = 'Single service affected';
            evidence.push('Change isolated to one service');
        } else if (affectedServices.size <= 3) {
            score = 50;
            description = 'Multiple services affected';
            evidence.push(`${affectedServices.size} services changed within 10 minutes`);
        } else {
            score = 80;
            description = 'Wide-reaching changes across many services';
            evidence.push(`${affectedServices.size} services changed simultaneously`);
            evidence.push('Coordinated changes increase system-wide risk');
        }

        // Check metadata for blast radius indicators
        if (event.meta) {
            if (event.meta.affects_all_users) {
                score += 20;
                evidence.push('Change affects all users');
            }
            if (event.meta.breaking_change) {
                score += 25;
                evidence.push('Breaking change detected');
            }
            if (event.meta.database_migration) {
                score += 15;
                evidence.push('Database migration affects data layer');
            }
        }

        return {
            name: 'Blast Radius',
            score: Math.min(score, 100),
            weight: this.SCORE_WEIGHTS.BLAST_RADIUS,
            description,
            evidence
        };
    }

    private static findEventCorrelations(
        events: ChangeEvent[],
        context: IncidentContext
    ): Array<{ events: ChangeEvent[]; description: string; riskIncrease: number }> {
        const correlations: Array<{ events: ChangeEvent[]; description: string; riskIncrease: number }> = [];

        // Find deployment chains
        const deployments = events.filter(e => e.type === 'deployment');
        if (deployments.length >= 2) {
            correlations.push({
                events: deployments,
                description: 'Multiple deployments in sequence can compound issues',
                riskIncrease: deployments.length * 10
            });
        }

        // Find migration + deployment combinations
        const migrations = events.filter(e => e.type === 'migration');
        if (migrations.length > 0 && deployments.length > 0) {
            correlations.push({
                events: [...migrations, ...deployments],
                description: 'Database migrations combined with deployments are high-risk',
                riskIncrease: 25
            });
        }

        // Find cross-service changes
        const services = new Set(events.map(e => e.service));
        if (services.size >= 3) {
            correlations.push({
                events: events,
                description: 'Changes across multiple services increase system complexity',
                riskIncrease: services.size * 5
            });
        }

        return correlations;
    }

    private static calculateOverallRisk(
        individualScores: Array<{ event: ChangeEvent; score: ScoreResult }>,
        correlations: Array<{ events: ChangeEvent[]; description: string; riskIncrease: number }>,
        context: IncidentContext
    ): ScoreResult {
        if (individualScores.length === 0) {
            return {
                score: 0,
                level: 'low',
                explanation: 'No change events found in the specified time window.',
                factors: [],
                recommendations: ['No recent changes detected - investigate other potential causes']
            };
        }

        // Calculate weighted average of individual scores
        const avgScore = individualScores.reduce((sum, item) => sum + item.score.score, 0) / individualScores.length;

        // Add correlation risk
        const correlationRisk = correlations.reduce((sum, corr) => sum + corr.riskIncrease, 0);

        const finalScore = Math.min(avgScore + correlationRisk, 100);

        const topFactors = individualScores
            .flatMap(item => item.score.factors)
            .sort((a, b) => (b.score * b.weight) - (a.score * a.weight))
            .slice(0, 5);

        return {
            score: Math.round(finalScore),
            level: this.getScoreLevel(finalScore),
            explanation: this.generateOverallExplanation(individualScores, correlations, finalScore),
            factors: topFactors,
            recommendations: this.generateOverallRecommendations(individualScores, correlations, finalScore)
        };
    }

    private static getScoreLevel(score: number): 'critical' | 'high' | 'medium' | 'low' {
        if (score >= 80) return 'critical';
        if (score >= 60) return 'high';
        if (score >= 40) return 'medium';
        return 'low';
    }

    private static generateExplanation(
        event: ChangeEvent,
        context: IncidentContext,
        factors: ScoreFactor[],
        score: number
    ): string {
        const level = this.getScoreLevel(score);
        const topFactor = factors.reduce((max, factor) =>
            (factor.score * factor.weight) > (max.score * max.weight) ? factor : max
        );

        let explanation = `This ${event.type} to ${event.service} has a ${level} risk score of ${Math.round(score)}/100. `;
        explanation += `The primary risk factor is ${topFactor.name.toLowerCase()}: ${topFactor.description}. `;

        if (level === 'critical' || level === 'high') {
            explanation += 'This change should be investigated as a potential root cause of the incident.';
        } else if (level === 'medium') {
            explanation += 'This change may have contributed to the incident and should be reviewed.';
        } else {
            explanation += 'This change is unlikely to be the primary cause but may be a contributing factor.';
        }

        return explanation;
    }

    private static generateOverallExplanation(
        individualScores: Array<{ event: ChangeEvent; score: ScoreResult }>,
        correlations: Array<{ events: ChangeEvent[]; description: string; riskIncrease: number }>,
        score: number
    ): string {
        const level = this.getScoreLevel(score);
        const highRiskEvents = individualScores.filter(item => item.score.score >= 60);

        let explanation = `Overall risk assessment: ${level} (${Math.round(score)}/100). `;
        explanation += `Analyzed ${individualScores.length} change events. `;

        if (highRiskEvents.length > 0) {
            explanation += `${highRiskEvents.length} high-risk changes identified. `;
        }

        if (correlations.length > 0) {
            explanation += `Found ${correlations.length} risk-amplifying correlations between changes. `;
        }

        return explanation;
    }

    private static generateRecommendations(
        event: ChangeEvent,
        context: IncidentContext,
        factors: ScoreFactor[],
        score: number
    ): string[] {
        const recommendations: string[] = [];
        const level = this.getScoreLevel(score);

        if (level === 'critical' || level === 'high') {
            recommendations.push('Immediately investigate this change as a primary suspect');
            recommendations.push('Check if rollback is possible and safe');
            recommendations.push('Review change approval and testing processes');
        }

        // Specific recommendations based on factors
        factors.forEach(factor => {
            if (factor.name === 'Timing Proximity' && factor.score >= 80) {
                recommendations.push('Verify exact timing correlation with incident onset');
            }
            if (factor.name === 'Event Type Risk' && event.type === 'migration') {
                recommendations.push('Check database performance and integrity');
                recommendations.push('Review migration logs for errors');
            }
            if (factor.name === 'Change Frequency' && factor.score >= 60) {
                recommendations.push('Implement change freezes during high-frequency periods');
            }
        });

        if (event.meta?.author) {
            recommendations.push(`Contact change author: ${event.meta.author}`);
        }

        return recommendations;
    }

    private static generateOverallRecommendations(
        individualScores: Array<{ event: ChangeEvent; score: ScoreResult }>,
        correlations: Array<{ events: ChangeEvent[]; description: string; riskIncrease: number }>,
        score: number
    ): string[] {
        const recommendations: string[] = [];
        const level = this.getScoreLevel(score);

        if (level === 'critical') {
            recommendations.push('URGENT: Multiple high-risk changes detected - coordinate immediate investigation');
            recommendations.push('Consider emergency rollback procedures');
        } else if (level === 'high') {
            recommendations.push('Prioritize investigation of identified high-risk changes');
            recommendations.push('Prepare rollback plans for recent changes');
        }

        const topEvents = individualScores
            .sort((a, b) => b.score.score - a.score.score)
            .slice(0, 3);

        topEvents.forEach((item, index) => {
            recommendations.push(`${index + 1}. Investigate ${item.event.type} to ${item.event.service} (score: ${item.score.score})`);
        });

        if (correlations.length > 0) {
            recommendations.push('Analyze change correlations and dependencies');
        }

        return recommendations;
    }
}