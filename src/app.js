import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { HttpError } from "./utils/http.js";
import { createQueryRouter } from "./routes/query.js";

export function createApp({ env, logger, pipeline }) {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("dev"));

  app.get("/health", (req, res) => {
    res.json({ ok: true, service: "curalink-backend" });
  });

  app.use("/api", createQueryRouter({ pipeline }));

  // 404
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

