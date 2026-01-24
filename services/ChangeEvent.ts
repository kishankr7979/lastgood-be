import crypto from 'crypto';
import { ChangeEventModel } from '../models/ChangeEvent';
import { GitHubChangeEventMapper } from '../mappers/github-events';

export class ChangeEventService {
    static async ingestFromGitHub({
        payload,
        organization_id,
        server
    }: {
        payload: any;
        organization_id: string;
        server: any;
    }) {
        // Ignore weird webhook edge cases
        if (!payload?.head_commit) return;

        const normalizedEvent =
            GitHubChangeEventMapper.mapPushEvent(payload);

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
            meta: normalizedEvent.meta
        });
    }
}
