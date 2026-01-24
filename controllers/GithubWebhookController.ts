import { FastifyRequest, FastifyReply } from 'fastify';
import { ChangeEventService } from '../services/ChangeEvent';

type GitHubWebhookParams = {
    orgId: string;
};

export class GitHubWebhookController {
    static async handle(req: FastifyRequest<{ Params: GitHubWebhookParams }>, reply: FastifyReply) {
        const eventType = req.headers['x-github-event'];
        const { orgId } = req.params

        console.log(orgId)

        // Only care about push events in MVP
        if (eventType !== 'push') {
            return reply.send({ ignored: true });
        }

        await ChangeEventService.ingestFromGitHub({
            payload: req.body,
            organization_id: orgId,
            server: req.server
        });

        return reply.send({ success: true });
    }
}
