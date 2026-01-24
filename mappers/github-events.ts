export class GitHubChangeEventMapper {
    static mapPushEvent(payload: any) {
        const branch = payload.ref?.replace('refs/heads/', '');

        const environment =
            branch === 'main' || branch === 'master'
                ? 'prod'
                : 'dev';

        return {
            occurred_at: new Date(payload.head_commit.timestamp),
            service: payload.repository.name,
            environment,
            type: 'deployment',
            summary: payload.head_commit.message,
            meta: {
                repo: payload.repository.full_name,
                commit: payload.head_commit.id,
                author: payload.head_commit.author?.name,
                branch
            }
        };
    }
}
