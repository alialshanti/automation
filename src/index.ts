import "dotenv/config";
import express, { Request } from "express";
import { webhookRouter } from "./routes/webhook";

const requiredEnvVars = [
  "GITHUB_WEBHOOK_SECRET",
  "DISCORD_WEBHOOK_URL",
];

for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    console.warn(`Warning: environment variable ${key} is not set`);
  }
}

const app = express();

// Capture the raw request body so the GitHub signature can be verified
// against the exact bytes GitHub sent, before JSON parsing/business logic runs.
app.use(
  express.json({
    verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
      req.rawBody = Buffer.from(buf);
    },
  })
);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/webhook", webhookRouter);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
