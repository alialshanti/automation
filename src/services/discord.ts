const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL as string;

/**
 * Sends a Discord message via an incoming webhook.
 * Errors are logged, not thrown, so a Discord outage never crashes the webhook server.
 */
export async function sendDiscordMessage(text: string): Promise<void> {
  try {
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: text,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `Discord API error (${response.status} ${response.statusText}): ${errorBody}`
      );
      return;
    }

    console.log("Discord message sent successfully");
  } catch (error) {
    console.error("Failed to send Discord message:", error);
  }
}
