import { Router, Request, Response } from "express";
import { verifySignature } from "../utils/verifySignature";
import { buildEmbed } from "../format";
import { sendDiscordEmbeds } from "../services/discord";
import type { Config } from "../config";

export function createWebhookRouter(config: Config): Router {
  const router = Router();

  router.post("/github", async (req: Request, res: Response) => {
    const signature = req.header("X-Hub-Signature-256");
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

    if (!rawBody || !verifySignature(rawBody, signature, config.githubWebhookSecret)) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    const event = req.header("X-GitHub-Event") ?? "unknown";
    const delivery = req.header("X-GitHub-Delivery") ?? "?";

    let embed;
    try {
      embed = buildEmbed(event, req.body);
    } catch (error) {
      console.error(`[${delivery}] Could not format "${event}" event:`, error);
      res.status(200).json({ received: true, forwarded: false });
      return;
    }

    if (!embed) {
      res.status(200).json({ received: true, forwarded: false });
      return;
    }

    // Forward before responding: on serverless platforms any work left
    // running after res.send() is killed. sendDiscordEmbeds has its own
    // 8s timeout, inside GitHub's 10s delivery limit, and never throws.
    const forwarded = await sendDiscordEmbeds(config.discordWebhookUrl, [embed]);
    if (!forwarded) {
      console.error(`[${delivery}] Failed to forward "${event}" event to Discord`);
    }
    res.status(200).json({ received: true, forwarded });
  });

  return router;
}
