import { FastifyRequest, FastifyReply } from "fastify";
import { ChangeEventService } from "../services/ChangeEvent";
import {ApiKeyModel} from "../models/ApiKey";
import {verifyGitHubSignature} from "../utils/validateGithubSignature";

type GitHubWebhookParams = {
  orgId: string;
};

export class GitHubWebhookController {
  static async handle(
    req: FastifyRequest<{ Params: GitHubWebhookParams }>,
    reply: FastifyReply
  ) {
    const eventType = req.headers["x-github-event"];
    const signature = req.headers["x-hub-signature-256"];
    const { orgId } = req.params;

    if(!signature || !req.rawBody) {
        return reply.code(401).send({success: false, error: "You must respond with a valid signature"});
    }


    const allowedEvents = ["push", "workflow_run", "page_build", "deployment"];

    // Only care about push events in MVP
    if (!allowedEvents.includes(eventType as string)) {
      return reply.send({ ignored: true });
    }

    const apiKeyModel = new ApiKeyModel(req.server);

    const apiKey = await apiKeyModel.getById(orgId);
      if (!apiKey) {
          return reply.code(404).send({
              success: false,
              message: 'API key not found'
          });
      }



      // Ensure the API key belongs to the authenticated organization
      if (apiKey.organization_id !== orgId) {
          return reply.code(404).send({
              success: false,
              message: 'API key not found'
          });
      }


      const key = apiKey.key_hash;

      const isValid = verifyGitHubSignature({
          payload: req.rawBody,
          signature: String(signature),
          secret: key
      })

      if (!isValid) {
          return reply.code(401).send({ error: 'Invalid GitHub signature' });
      }

    await ChangeEventService.ingestFromGitHub({
      payload: req.body,
      eventType: String(eventType),
      organization_id: orgId,
      server: req.server,
    });

    return reply.send({ success: true });
  }
}
