import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config";

const valid = {
  GITHUB_WEBHOOK_SECRET: "abc",
  DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/123456789/tokentokentoken",
};

test("loads a valid environment", () => {
  const config = loadConfig({ ...valid, PORT: "8080" } as NodeJS.ProcessEnv);
  assert.equal(config.githubWebhookSecret, "abc");
  assert.equal(config.port, 8080);
});

test("defaults the port to 3000", () => {
  assert.equal(loadConfig(valid as NodeJS.ProcessEnv).port, 3000);
});

test("alert mention defaults to @here, respects override and 'off'", () => {
  assert.equal(loadConfig(valid as NodeJS.ProcessEnv).alertMention, "@here");
  assert.equal(
    loadConfig({ ...valid, DISCORD_ALERT_MENTION: "<@&123>" } as NodeJS.ProcessEnv).alertMention,
    "<@&123>"
  );
  assert.equal(
    loadConfig({ ...valid, DISCORD_ALERT_MENTION: "off" } as NodeJS.ProcessEnv).alertMention,
    ""
  );
});

test("throws listing every missing variable", () => {
  assert.throws(() => loadConfig({} as NodeJS.ProcessEnv), /GITHUB_WEBHOOK_SECRET.*DISCORD_WEBHOOK_URL/s);
});

test("rejects a non-Discord webhook URL", () => {
  assert.throws(
    () => loadConfig({ ...valid, DISCORD_WEBHOOK_URL: "https://example.com/hook" } as NodeJS.ProcessEnv),
    /Discord webhook URL/
  );
});

test("rejects a nonsense port", () => {
  assert.throws(
    () => loadConfig({ ...valid, PORT: "abc" } as NodeJS.ProcessEnv),
    /PORT must be a port number/
  );
});
