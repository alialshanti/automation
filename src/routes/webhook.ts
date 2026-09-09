import { Router, Request, Response } from "express";
import { verifySignature } from "../utils/verifySignature";
import { sendDiscordMessage } from "../services/discord";

export const webhookRouter = Router();

webhookRouter.post("/github", (req: Request, res: Response) => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET as string;
  const signature = req.header("X-Hub-Signature-256");
  const rawBody = (req as Request & { rawBody: Buffer }).rawBody;

  if (!verifySignature(rawBody, signature, secret)) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const event = req.header("X-GitHub-Event") ?? "unknown";
  const payload = req.body;

  const message = formatMessage(event, payload);

  // Respond immediately; GitHub expects a fast response and doesn't need to wait on Discord.
  res.status(200).json({ received: true });

  if (message) {
    sendDiscordMessage(toDiscordMarkdown(message));
  }
});

// The formatters emit single-asterisk bold; Discord uses double-asterisk.
function toDiscordMarkdown(text: string): string {
  return text.replace(/\*([^*]+)\*/g, "**$1**");
}

function formatMessage(event: string, payload: any): string | null {
  switch (event) {
    case "push":
      return formatPushMessage(payload);
    case "pull_request":
      return formatPullRequestMessage(payload);
    case "issues":
      return formatIssuesMessage(payload);
    case "workflow_run":
      return formatWorkflowRunMessage(payload);
    case "ping":
      return null;
    default:
      return formatGenericMessage(event, payload);
  }
}

function formatPushMessage(payload: any): string {
  const pusher = payload.pusher?.name ?? "unknown";
  const repo = payload.repository?.full_name ?? "unknown repo";
  const branch = (payload.ref ?? "").replace("refs/heads/", "") || "unknown branch";
  const commits = payload.commits ?? [];
  const commitCount = commits.length;
  const latestCommit = commits[commits.length - 1];
  const latestMessage = latestCommit?.message ?? "(no commit message)";
  const compareUrl = payload.compare ?? "";

  return (
    `🔔 *Push to ${repo}*\n` +
    `Pusher: ${pusher}\n` +
    `Branch: \`${branch}\`\n` +
    `Commits: ${commitCount}\n` +
    `Latest: ${latestMessage}\n` +
    (compareUrl ? `[View compare](${compareUrl})` : "")
  );
}

function formatPullRequestMessage(payload: any): string {
  const action = payload.action ?? "unknown";
  const pr = payload.pull_request ?? {};
  const repo = payload.repository?.full_name ?? "unknown repo";
  const title = pr.title ?? "(no title)";
  const author = pr.user?.login ?? "unknown";
  const url = pr.html_url ?? "";
  const merged = pr.merged ? "merged" : action;

  return (
    `🔀 *Pull Request ${merged} in ${repo}*\n` +
    `Title: ${title}\n` +
    `Author: ${author}\n` +
    (url ? `[View PR](${url})` : "")
  );
}

function formatIssuesMessage(payload: any): string {
  const action = payload.action ?? "unknown";
  const issue = payload.issue ?? {};
  const repo = payload.repository?.full_name ?? "unknown repo";
  const title = issue.title ?? "(no title)";
  const author = issue.user?.login ?? "unknown";
  const url = issue.html_url ?? "";

  return (
    `🐛 *Issue ${action} in ${repo}*\n` +
    `Title: ${title}\n` +
    `Author: ${author}\n` +
    (url ? `[View issue](${url})` : "")
  );
}

function formatWorkflowRunMessage(payload: any): string | null {
  if (payload.action !== "completed") {
    return null;
  }

  const run = payload.workflow_run ?? {};
  const repo = payload.repository?.full_name ?? "unknown repo";
  const workflowName = run.name ?? "unknown workflow";
  const branch = run.head_branch ?? "unknown branch";
  const conclusion = run.conclusion ?? "unknown";
  const url = run.html_url ?? "";

  const emoji = conclusion === "success" ? "✅" : conclusion === "cancelled" ? "⚠️" : "❌";
  const verb = conclusion === "success" ? "succeeded" : conclusion === "cancelled" ? "was cancelled" : "failed";

  return (
    `${emoji} CI ${verb} on ${repo}\n` +
    `Workflow: ${workflowName}\n` +
    `Branch: ${branch}\n` +
    (url ? `Link: ${url}` : "")
  );
}

function formatGenericMessage(event: string, payload: any): string {
  const repo = payload.repository?.full_name ?? "unknown repo";
  const actor = payload.sender?.login ?? "unknown";

  return `📣 New ${event} on ${repo} by ${actor}`;
}
