# OnlineFormapro

Forwards GitHub webhook events (push, pull requests, issues, and more) to a
Discord channel.

## How it works

1. GitHub sends a webhook `POST` request to `/webhook/github` for events on a
   repository.
2. The request signature is verified against `GITHUB_WEBHOOK_SECRET` using
   HMAC SHA-256 (see [src/utils/verifySignature.ts](src/utils/verifySignature.ts)).
3. The event payload is formatted into a human-readable message
   (see [src/routes/webhook.ts](src/routes/webhook.ts)).
4. The message is sent to Discord via an incoming webhook. A Discord outage is
   logged, not thrown, so it never crashes the server.

## Requirements

- Node.js 18+ (for global `fetch`)
- A Discord server and channel to post to
- A GitHub repository to attach the webhook to

## Setup

1. Install dependencies:

   ```
   npm install
   ```

2. Copy the example environment file and fill in the values (see below):

   ```
   cp .env.example .env
   ```

3. Run in development mode:

   ```
   npm run dev
   ```

   Or build and run the compiled output:

   ```
   npm run build
   npm start
   ```

The server exposes:

- `GET /health` — health check, returns `{ status: "ok" }`
- `POST /webhook/github` — the GitHub webhook endpoint

## Environment variables

| Variable                | Description                                                                |
| ----------------------- | ------------------------------------------------------------------------- |
| `GITHUB_WEBHOOK_SECRET` | Secret configured on the GitHub webhook, used to verify request signatures |
| `DISCORD_WEBHOOK_URL`   | Discord incoming webhook URL to send notifications to                     |
| `PORT`                  | Port the server listens on (Render sets this automatically in production)  |

### Creating a Discord webhook

1. In your Discord server, go to **Server Settings → Integrations →
   Webhooks**.
2. Click **New Webhook**, pick the channel notifications should post to, and
   optionally rename/re-icon it.
3. Click **Copy Webhook URL**.
4. Put that URL in `DISCORD_WEBHOOK_URL`.

### Configuring the GitHub webhook

1. In your repository, go to **Settings → Webhooks → Add webhook**.
2. Set **Payload URL** to `https://<your-deployed-host>/webhook/github`.
3. Set **Content type** to `application/json`.
4. Set **Secret** to the same value as `GITHUB_WEBHOOK_SECRET`.
5. Choose which events to send (push, pull requests, issues, or "Send me
   everything").

## Deploying to Render

1. Create a new **Web Service** on [Render](https://render.com) pointing at
   this repository.
2. Set the build command to `npm install && npm run build` and the start
   command to `npm start`.
3. Add the environment variables under the service's **Environment** tab:
   - `GITHUB_WEBHOOK_SECRET`
   - `DISCORD_WEBHOOK_URL`
   - Render sets `PORT` automatically — no need to add it yourself.
4. Deploy, then point your GitHub webhook's Payload URL at the Render
   service's public URL (e.g. `https://your-app.onrender.com/webhook/github`).
