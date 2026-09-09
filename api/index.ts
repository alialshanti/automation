import "dotenv/config";
import { loadConfig } from "../src/config";
import { createApp } from "../src/app";

/**
 * Vercel serverless entrypoint.
 *
 * vercel.json rewrites every path to this function, and the Express app
 * routes `/health` and `/webhook/github` as usual. The webhook handler
 * forwards to Discord *before* responding, so nothing is lost when the
 * function is frozen after the response.
 */
export default createApp(loadConfig());
