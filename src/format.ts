import type { DiscordEmbed } from "./services/discord";

const COLOR = {
  blurple: 0x5865f2,
  green: 0x57f287,
  red: 0xed4245,
  yellow: 0xfee75c,
  purple: 0x9b59b6,
  orange: 0xe67e22,
  grey: 0x95a5a6,
} as const;

const MAX_TITLE = 256;
const MAX_DESCRIPTION = 4096;
const BODY_PREVIEW = 500;

export interface Notification {
  embed: DiscordEmbed;
  /** Whether to ping (PR opened/merged, CI failure). */
  alert: boolean;
}

/**
 * Turns a GitHub webhook (event name + JSON payload) into a Discord
 * notification, or `null` when the event shouldn't produce one.
 */
export function buildNotification(event: string, payload: any): Notification | null {
  const embed = buildEmbed(event, payload);
  if (!embed) return null;
  return { embed, alert: isAlert(event, payload) };
}

/** The handful of events worth pinging the team about. */
function isAlert(event: string, payload: any): boolean {
  if (event === "pull_request") {
    if (payload.action === "opened") return true;
    return payload.action === "closed" && Boolean(payload.pull_request?.merged);
  }
  if (event === "workflow_run") {
    return (
      payload.action === "completed" &&
      ["failure", "timed_out"].includes(payload.workflow_run?.conclusion)
    );
  }
  return false;
}

/**
 * Turns a GitHub webhook (event name + JSON payload) into a Discord embed,
 * or `null` when the event shouldn't produce a notification.
 */
export function buildEmbed(event: string, payload: any): DiscordEmbed | null {
  switch (event) {
    case "ping":
      return null;
    case "push":
      return pushEmbed(payload);
    case "pull_request":
      return pullRequestEmbed(payload);
    case "issues":
      return issuesEmbed(payload);
    case "release":
      return releaseEmbed(payload);
    case "workflow_run":
      return workflowRunEmbed(payload);
    case "create":
    case "delete":
      return refEmbed(event, payload);
    case "star":
      return starEmbed(payload);
    default:
      return genericEmbed(event, payload);
  }
}

function base(payload: any): DiscordEmbed {
  const sender = payload?.sender;
  const repo = payload?.repository;
  const embed: DiscordEmbed = { timestamp: new Date().toISOString() };
  if (sender?.login) {
    embed.author = { name: sender.login, url: sender.html_url, icon_url: sender.avatar_url };
  }
  if (repo?.full_name) {
    embed.footer = { text: repo.full_name };
  }
  return embed;
}

function truncate(text: string, max: number): string {
  const value = String(text ?? "");
  return value.length <= max ? value : value.slice(0, max - 1) + "…";
}

function firstLine(text: unknown): string {
  return String(text ?? "").split("\n")[0];
}

function repoName(payload: any): string {
  return payload?.repository?.full_name ?? "unknown/repo";
}

function pushEmbed(payload: any): DiscordEmbed | null {
  const commits: any[] = Array.isArray(payload.commits) ? payload.commits : [];
  // Branch/tag creates & deletes also arrive as a push with no commits;
  // the dedicated create/delete events report those more clearly.
  if (commits.length === 0) return null;

  const ref = String(payload.ref ?? "").replace(/^refs\/(heads|tags)\//, "");
  const shown = commits.slice(-10);
  const lines = shown.map((c) => {
    const sha = String(c.id ?? "").slice(0, 7);
    return `[\`${sha}\`](${c.url}) ${truncate(firstLine(c.message), 72)}`;
  });
  if (commits.length > shown.length) {
    lines.push(`…and ${commits.length - shown.length} more`);
  }

  const plural = commits.length === 1 ? "" : "s";
  const forced = payload.forced ? " (force-push)" : "";

  return {
    ...base(payload),
    color: COLOR.blurple,
    title: truncate(`${commits.length} new commit${plural}${forced} to ${repoName(payload)}`, MAX_TITLE),
    url: payload.compare,
    fields: [
      { name: "Branch", value: `\`${ref}\`` },
      { name: `Commit${plural}`, value: truncate(lines.join("\n"), 1024) },
    ],
  };
}

function pullRequestEmbed(payload: any): DiscordEmbed | null {
  const action: string = payload.action;
  if (!["opened", "reopened", "closed", "ready_for_review", "converted_to_draft"].includes(action)) {
    return null;
  }

  const pr = payload.pull_request ?? {};
  const number = payload.number ?? pr.number;

  let verb = action.replace(/_/g, " ");
  let color: number = COLOR.grey;
  if (action === "closed") {
    verb = pr.merged ? "merged" : "closed";
    color = pr.merged ? COLOR.purple : COLOR.red;
  } else if (action === "opened" || action === "reopened") {
    color = COLOR.green;
  }

  const embed: DiscordEmbed = {
    ...base(payload),
    color,
    title: truncate(`[${repoName(payload)}] PR #${number} ${verb}: ${pr.title ?? ""}`, MAX_TITLE),
    url: pr.html_url,
  };

  if (pr.body && (action === "opened" || action === "reopened")) {
    embed.description = truncate(pr.body, BODY_PREVIEW);
  }

  const stats: string[] = [];
  if (Number.isFinite(pr.commits)) stats.push(`${pr.commits} commit${pr.commits === 1 ? "" : "s"}`);
  if (Number.isFinite(pr.changed_files)) stats.push(`${pr.changed_files} file${pr.changed_files === 1 ? "" : "s"}`);
  if (Number.isFinite(pr.additions) && Number.isFinite(pr.deletions)) stats.push(`+${pr.additions} −${pr.deletions}`);
  if (stats.length && pr.head?.ref && pr.base?.ref) {
    embed.fields = [{ name: `${pr.head.ref} → ${pr.base.ref}`, value: stats.join(" · ") }];
  }

  return embed;
}

function issuesEmbed(payload: any): DiscordEmbed | null {
  const action: string = payload.action;
  if (!["opened", "reopened", "closed"].includes(action)) return null;

  const issue = payload.issue ?? {};
  const embed: DiscordEmbed = {
    ...base(payload),
    color: action === "closed" ? COLOR.grey : COLOR.orange,
    title: truncate(`[${repoName(payload)}] Issue #${issue.number} ${action}: ${issue.title ?? ""}`, MAX_TITLE),
    url: issue.html_url,
  };
  if (issue.body && action === "opened") {
    embed.description = truncate(issue.body, BODY_PREVIEW);
  }
  return embed;
}

function releaseEmbed(payload: any): DiscordEmbed | null {
  if (payload.action !== "published") return null;
  const release = payload.release ?? {};
  return {
    ...base(payload),
    color: COLOR.green,
    title: truncate(`[${repoName(payload)}] Release ${release.tag_name ?? ""} published`, MAX_TITLE),
    url: release.html_url,
    description: release.body ? truncate(release.body, MAX_DESCRIPTION) : release.name || undefined,
  };
}

function workflowRunEmbed(payload: any): DiscordEmbed | null {
  if (payload.action !== "completed") return null;
  const run = payload.workflow_run ?? {};
  const conclusion: string = run.conclusion ?? "unknown";
  if (conclusion === "skipped") return null;

  const info: Record<string, { color: number; label: string }> = {
    success: { color: COLOR.green, label: "succeeded" },
    failure: { color: COLOR.red, label: "failed" },
    cancelled: { color: COLOR.yellow, label: "was cancelled" },
    timed_out: { color: COLOR.red, label: "timed out" },
    action_required: { color: COLOR.yellow, label: "needs action" },
  };
  const { color, label } = info[conclusion] ?? { color: COLOR.grey, label: conclusion };

  return {
    ...base(payload),
    color,
    title: truncate(`[${repoName(payload)}] ${run.name ?? "Workflow"} ${label} on ${run.head_branch ?? ""}`, MAX_TITLE),
    url: run.html_url,
  };
}

function refEmbed(event: string, payload: any): DiscordEmbed | null {
  const refType: string = payload.ref_type;
  if (refType !== "branch" && refType !== "tag") return null;
  const verb = event === "create" ? "created" : "deleted";
  return {
    ...base(payload),
    color: event === "create" ? COLOR.green : COLOR.red,
    title: truncate(`[${repoName(payload)}] ${refType} ${verb}: ${payload.ref}`, MAX_TITLE),
    url: payload.repository?.html_url,
  };
}

function starEmbed(payload: any): DiscordEmbed | null {
  if (payload.action !== "created") return null;
  const repo = payload.repository ?? {};
  return {
    ...base(payload),
    color: COLOR.yellow,
    title: truncate(`[${repo.full_name}] New star ⭐ — ${repo.stargazers_count ?? "?"} total`, MAX_TITLE),
    url: repo.html_url,
  };
}

function genericEmbed(event: string, payload: any): DiscordEmbed | null {
  if (!payload?.repository?.full_name) return null;
  const action = payload.action ? ` (${payload.action})` : "";
  return {
    ...base(payload),
    color: COLOR.grey,
    title: truncate(`[${repoName(payload)}] ${event}${action}`, MAX_TITLE),
  };
}
