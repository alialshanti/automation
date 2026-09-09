export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  timestamp?: string;
  author?: { name: string; url?: string; icon_url?: string };
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
}

const REQUEST_TIMEOUT_MS = 8_000;
const MAX_ATTEMPTS = 3;

/**
 * Posts embeds to a Discord incoming webhook.
 *
 * Retries on rate limits (429) and transient 5xx responses, honoring
 * Discord's Retry-After. Every request has an 8s timeout, comfortably
 * inside GitHub's 10s webhook-delivery budget. Never throws — it returns
 * whether the message was delivered so the caller can still ack GitHub.
 */
export async function sendDiscordEmbeds(
  webhookUrl: string,
  embeds: DiscordEmbed[],
  content?: string
): Promise<boolean> {
  const payload: Record<string, unknown> = { embeds };
  if (content) {
    payload.content = content;
    // Only the `content` string can ping; embeds never do. Allow @here/@everyone
    // and role mentions there, but never user mentions from stray text.
    payload.allowed_mentions = { parse: ["everyone", "roles"] };
  }
  const body = JSON.stringify(payload);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetchWithTimeout(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (response.ok) return true;

      const transient = response.status === 429 || response.status >= 500;
      if (transient && attempt < MAX_ATTEMPTS) {
        await sleep(await retryDelayMs(response, attempt));
        continue;
      }

      console.error(
        `Discord webhook error (${response.status} ${response.statusText}): ${await safeText(response)}`
      );
      return false;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.error(`Discord webhook request failed (attempt ${attempt}/${MAX_ATTEMPTS}): ${reason}`);
      if (attempt < MAX_ATTEMPTS) {
        await sleep(500 * attempt);
        continue;
      }
      return false;
    }
  }

  return false;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function retryDelayMs(response: Response, attempt: number): Promise<number> {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return clampDelay(seconds * 1000);
  }
  try {
    const data = (await response.clone().json()) as { retry_after?: number };
    if (typeof data.retry_after === "number") return clampDelay(data.retry_after * 1000);
  } catch {
    // body wasn't JSON — fall through to a backoff default
  }
  return clampDelay(500 * 2 ** (attempt - 1));
}

function clampDelay(ms: number): number {
  return Math.min(Math.max(ms, 250), 5_000);
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500) || "<empty body>";
  } catch {
    return "<unreadable body>";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
