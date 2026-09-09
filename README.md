# OnlineFormapro

Receives GitHub webhook events and posts them to a Discord channel as clean,
colour-coded embeds.

## What it does

- Verifies every request against `GITHUB_WEBHOOK_SECRET` (HMAC SHA-256,
  constant-time) — unsigned or tampered requests get `401`.
- Formats the event into a Discord embed
  (see [src/format.ts](src/format.ts)) with sensible, low-noise defaults:
  | Event | Notifies on |
  | ----- | ----------- |
  | `push` | any push that contains commits (lists up to 10) |
  | `pull_request` | opened, reopened, closed/merged, ready for review, converted to draft |
  | `issues` | opened, reopened, closed |
  | `workflow_run` | completed (success, failure, cancelled, timed out…) — skips `skipped` |
  | `release` | published |
  | `create` / `delete` | branch or tag created / deleted |
  | `star` | new star |
  | anything else | a one-line generic embed (only if it carries a repo) |
- Forwards to Discord **before** replying to GitHub, with an 8s timeout and
  retries on rate limits / 5xx. A Discord outage is logged, never fatal, and
  the endpoint still returns `200`.

## Endpoints

- `GET /health` — returns `{ "status": "ok" }`
- `POST /webhook/github` — the GitHub webhook endpoint

## Run locally

```
npm install
cp .env.example .env      # then fill in the two required values
npm run dev               # watch mode
```

Other scripts:

```
npm run build       # compile TypeScript to dist/
npm start           # run the compiled server
npm run typecheck   # tsc --noEmit
npm test            # unit tests (node:test)
```

## Environment variables

| Variable                | Required | Description                                                             |
| ----------------------- | :------: | --------------------------------------------------------------------- |
| `GITHUB_WEBHOOK_SECRET` |   yes    | Secret set on the GitHub webhook, used to verify request signatures    |
| `DISCORD_WEBHOOK_URL`   |   yes    | Discord incoming webhook URL (`https://discord.com/api/webhooks/…`)   |
| `PORT`                  |    no    | Port to listen on (default `3000`; most hosts set this for you)        |

Generate a secret:

```
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

## Deploy (free options)

The app is a normal long-running Node server, so any of these work with no
code changes:

- **Render** — `render.yaml` is included. New → Blueprint, point it at this
  repo, set the two env vars. Free tier sleeps after ~15 min idle; the first
  request after a sleep can be slow, but GitHub retries.
- **Koyeb** — free tier, stays awake 24/7. Deploy from GitHub, build
  `npm install && npm run build`, run `npm start`.
- **Fly.io / Railway / any VPS** — same build and start commands.

### 1. Create a Discord webhook

Server Settings → Integrations → Webhooks → New Webhook → pick a channel →
Copy Webhook URL → put it in `DISCORD_WEBHOOK_URL`.

### 2. Deploy

Deploy with the build command `npm install && npm run build` and the start
command `npm start`, and set `GITHUB_WEBHOOK_SECRET` and
`DISCORD_WEBHOOK_URL`. Check `https://<your-host>/health` afterwards.

### 3. Add the GitHub webhook

Repo → Settings → Webhooks → Add webhook:

- **Payload URL:** `https://<your-host>/webhook/github`
- **Content type:** `application/json`
- **Secret:** same value as `GITHUB_WEBHOOK_SECRET`
- **Events:** pick what you want, or "Send me everything"

Push a commit and check the channel. GitHub shows each delivery and its
response under **Recent Deliveries**.

## Project layout

```
src/
  index.ts              startup: load config, start server, graceful shutdown
  app.ts                Express app factory (raw-body capture, routes)
  config.ts             environment loading + validation
  format.ts             GitHub event -> Discord embed
  routes/webhook.ts     POST /webhook/github handler
  services/discord.ts   Discord webhook client (timeout + retries)
  utils/verifySignature.ts   HMAC SHA-256 signature check
test/                   unit tests (node:test)
```
