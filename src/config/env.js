import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  MONGODB_URI: z.string().min(1),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  // Retrieval depth controls
  RETRIEVAL_MIN: z.coerce.number().int().min(1).default(50),
  RETRIEVAL_MAX: z.coerce.number().int().min(1).default(200),

  // Optional caching
  CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(600),

  // Ollama (local open-source LLM)
  OLLAMA_BASE_URL: z.string().default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().default("mistral"),
  OLLAMA_TIMEOUT_MS: z.coerce.number().int().min(1000).default(120000),
});

export function loadEnv(processEnv = process.env) {
  const parsed = EnvSchema.safeParse(processEnv);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}

