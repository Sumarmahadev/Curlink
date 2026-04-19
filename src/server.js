import "dotenv/config";
import { loadEnv } from "./config/env.js";
import { createLogger } from "./config/logger.js";
import { connectMongo } from "./db/mongoose.js";
import { createApp } from "./app.js";
import { createOllamaClient } from "./services/llm/ollamaClient.js";
import { createAssistantPipeline } from "./services/pipeline/runAssistant.js";

const env = loadEnv();
const logger = createLogger({ level: env.NODE_ENV === "production" ? "info" : "debug" });

await connectMongo(env.MONGODB_URI, { logger });

const ollamaClient = createOllamaClient({
  baseUrl: env.OLLAMA_BASE_URL,
  model: env.OLLAMA_MODEL,
  timeoutMs: env.OLLAMA_TIMEOUT_MS,
  logger,
});

const pipeline = createAssistantPipeline({ env, logger, ollamaClient });
const app = createApp({ env, logger, pipeline });

app.listen(env.PORT, () => {
  logger.info(`Backend listening on http://localhost:${env.PORT}`);
});

