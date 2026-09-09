import express, { ErrorRequestHandler, Request } from "express";
import { createWebhookRouter } from "./routes/webhook";
import type { Config } from "./config";

/**
 * Builds the Express app. Kept separate from server startup so it can be
 * imported by tests or a serverless entrypoint without opening a port.
 */
export function createApp(config: Config): express.Express {
  const app = express();
  app.disable("x-powered-by");

  app.use(
    express.json({
      // GitHub webhook payloads can be large (big pushes, long diffs).
      limit: "25mb",
      verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
        // Keep the exact bytes GitHub signed, before JSON parsing.
        req.rawBody = Buffer.from(buf);
      },
    })
  );

  app.get("/", (_req, res) => res.redirect(302, "/health"));
  app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

  app.use("/webhook", createWebhookRouter(config));

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Request error:", message);
    res.status(400).json({ error: "Bad request" });
  };
  app.use(errorHandler);

  return app;
}
