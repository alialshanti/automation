import "dotenv/config";
import type { Request, Response } from "express";
import { loadConfig } from "../src/config";
import { createApp } from "../src/app";

/**
 * Vercel serverless entrypoint.
 *
 * vercel.json rewrites every path here; the Express app routes `/health`
 * and `/webhook/github`. If configuration is invalid we still boot, but
 * every request returns a 500 that says exactly what's wrong (instead of
 * an opaque FUNCTION_INVOCATION_FAILED crash).
 */
let app: (req: Request, res: Response) => void;

try {
  app = createApp(loadConfig());
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  console.error("Startup failed:", detail);
  app = (_req, res) => {
    res.status(500).json({ error: "Server misconfigured", detail });
  };
}

export default (req: Request, res: Response) => app(req, res);
