import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { HttpError } from "./utils/http.js";
import { createQueryRouter } from "./routes/query.js";

export function createApp({ env, logger, pipeline }) {
  const app = express();

  // Security & middleware
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("dev"));

  // Health check under /api for consistency
  app.get("/api/health", (req, res) => {
    res.json({ ok: true, service: "curalink-backend" });
  });

  // Main API routes
  app.use("/api", createQueryRouter({ pipeline }));

  // 404 handler
  app.use((req, res, next) => next(new HttpError(404, "Not Found")));

  // Error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err?.status || 500;
    const payload = {
      error: err?.message || "Internal Server Error",
      details: err?.details,
    };
    if (status >= 500) logger?.error?.("Unhandled error", err);
    res.status(status).json(payload);
  });

  return app;
}
