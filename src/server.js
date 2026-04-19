import "dotenv/config";
import { loadEnv } from "./config/env.js";
import { createLogger } from "./config/logger.js";
import { connectMongo } from "./db/mongoose.js";
import { createApp } from "./app.js";
import { createOllamaClient } from "./services/llm/ollamaClient.js";
import { createAssistantPipeline } from "./services/pipeline/runAssistant.js";

// Load environment and logger
const env = loadEnv();
const logger = createLogger({
  level: env.NODE_ENV === "production" ? "info" : "debug",
});

// Connect to MongoDB
await connectMongo(env.MONGODB_URI, { logger });

// Configure Ollama client
const ollamaClient = createOllamaClient({
  baseUrl: env.OLLAMA_BASE_URL,
  model: env.OLLAMA_MODEL,
  timeoutMs: env.OLLAMA_TIMEOUT_MS,
  logger,
});

// Build assistant pipeline
const pipeline = createAssistantPipeline({ env, logger, ollamaClient });

// Create Express app
const app = createApp({ env, logger, pipeline });

// Use Render’s injected PORT if available, otherwise fallback
const port = process.env.PORT || env.PORT || 8080;

app.listen(port, () => {
  logger.info(`Backend listening on http://localhost:${port}`);
});
