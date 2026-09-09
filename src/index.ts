import "dotenv/config";
import { loadConfig } from "./config";
import { createApp } from "./app";

function main(): void {
  const config = loadConfig();
  const app = createApp(config);

  const server = app.listen(config.port, () => {
    console.log(`Listening on port ${config.port}`);
  });

  const shutdown = (signal: string): void => {
    console.log(`${signal} received — shutting down`);
    server.close(() => process.exit(0));
    // Don't hang forever if a connection won't close.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
