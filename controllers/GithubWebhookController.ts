import { FastifyRequest, FastifyReply } from 'fastify';
import { ChangeEventService } from '../services/ChangeEvent';

type GitHubWebhookParams = {
    orgId: string;
};

export class GitHubWebhookController {
    static async handle(req: FastifyRequest<{ Params: GitHubWebhookParams }>, reply: FastifyReply) {
        const eventType = req.headers['x-github-event'];
        const { orgId } = req.params

        const allowedEvents = ['push', 'workflow_run', 'page_build', 'deployment'];

        // Only care about push events in MVP
        if (!allowedEvents.includes(eventType as string)) {
            return reply.send({ ignored: true });
        }

        await ChangeEventService.ingestFromGitHub({
            payload: req.body,
            eventType: String(eventType),
            organization_id: orgId,
            server: req.server
        });

        return reply.send({ success: true });
    }
}
