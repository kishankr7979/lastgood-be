export class GitHubChangeEventMapper {
    static mapPushEvent(payload: any) {
        const branch = payload.ref?.replace('refs/heads/', '');

        return {
            occurred_at: new Date(payload.head_commit.timestamp),
            service: payload.repository.name,
            environment: branch === 'main' ? 'prod' : 'dev',
            type: 'deployment',
            summary: payload.head_commit.message,
            confidence: 0.3,
            meta: {
                commit: payload.head_commit.id,
                branch,
                author: payload.head_commit.author?.name
            }
        };
    }

    static mapDeploymentEvent(payload: any) {
        const d = payload.deployment;

        return {
            occurred_at: new Date(d.created_at),
            service: payload.repository.name,
            environment: d.environment?.toLowerCase() === 'production'
                ? 'prod'
                : 'staging',
            type: 'deployment',
            summary: `Deployment created (${d.environment})`,
            confidence: 0.8,
            meta: {
                commit: d.sha,
                deployment_id: d.id,
                triggered_by: d.creator?.login
            }
        };
    }

    static mapDeploymentStatusEvent(payload: any) {
        const status = payload.deployment_status;

        return {
            occurred_at: new Date(status.created_at),
            service: payload.repository.name,
            environment: status.environment,
            type: 'deployment',
            summary: `Deployment ${status.state}`,
            confidence: status.state === 'success' ? 0.95 : 0.6,
            meta: {
                state: status.state,
                url: status.environment_url,
                deployment_id: payload.deployment.id,
                commit: payload.deployment.sha
            }
        };
    }


}


