import crypto from 'crypto';
import { ChangeEventModel } from '../models/ChangeEvent';
import { GitHubChangeEventMapper } from '../mappers/github-events';


export interface ChangeEvent {
    payload: any,
    eventType: string,
    organization_id: string,
    server: any
}

export class ChangeEventService {
    static async ingestFromGitHub({
                                      payload,
                                      eventType,
                                      organization_id,
                                      server
                                  }: ChangeEvent) {
        let normalizedEvent;

        switch (eventType) {
            case 'push':
                normalizedEvent =
                    GitHubChangeEventMapper.mapPushEvent(payload);
                break;

            case 'deployment':
                normalizedEvent =
                    GitHubChangeEventMapper.mapDeploymentEvent(payload);
                break;

            case 'deployment_status':
                normalizedEvent =
                    GitHubChangeEventMapper.mapDeploymentStatusEvent(payload);
                break;

            default:
                return; // ignore noise
        }

        if (!normalizedEvent) return;

        const model = new ChangeEventModel(server);

        return model.create({
            id: crypto.randomUUID(),
            occurred_at: normalizedEvent.occurred_at,
            organization_id,
            service: normalizedEvent.service,
            environment: normalizedEvent.environment,
            type: normalizedEvent.type,
            source: 'github',
            summary: normalizedEvent.summary,
            meta: normalizedEvent.meta,
            // confidence: normalizedEvent.confidence
        });
    }
}
