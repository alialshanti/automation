export interface Config {
  githubWebhookSecret: string;
  discordWebhookUrl: string;
  port: number;
}

/**
 * Reads and validates configuration from the environment.
 * Throws once with a clear message listing everything that's wrong,
 * so a misconfigured deploy fails fast instead of half-working.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const missing: string[] = [];

  const read = (name: string): string => {
    const value = env[name]?.trim();
    if (!value) missing.push(name);
    return value ?? "";
  };

  const githubWebhookSecret = read("GITHUB_WEBHOOK_SECRET");
  const discordWebhookUrl = read("DISCORD_WEBHOOK_URL");

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        "Copy .env.example to .env and fill them in."
    );
  }

  if (
    !/^https:\/\/(discord\.com|discordapp\.com|ptb\.discord\.com|canary\.discord\.com)\/api\/webhooks\/\d+\/[\w-]+/.test(
      discordWebhookUrl
    )
  ) {
    throw new Error(
      "DISCORD_WEBHOOK_URL does not look like a Discord webhook URL " +
        "(expected https://discord.com/api/webhooks/<id>/<token>)."
    );
  }

  const port = env.PORT ? Number(env.PORT) : 3000;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`PORT must be a port number between 1 and 65535, got "${env.PORT}".`);
  }

  return { githubWebhookSecret, discordWebhookUrl, port };
}
