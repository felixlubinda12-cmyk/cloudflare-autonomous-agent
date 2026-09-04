/**
 * Cloudflare Worker Environment Types
 */
export interface Env {
  // Bindings
  AGENT_KV: KVNamespace;
  AGENT_DB: D1Database;
  AGENT_STORAGE: R2Bucket;

  // Secrets
  GEMINI_API_KEY: string;
  CLOUDFLARE_API_TOKEN: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;

  // Configuration / Optional variables
  CLOUDFLARE_ACCOUNT_ID?: string;
  TELEGRAM_OWNER_ID?: string;
  GEMINI_MODEL?: string;
  AGENT_MAX_ITERATIONS?: string;
  LOG_LEVEL?: string;
  ENVIRONMENT?: string;
  ADMIN_SECRET?: string;
}

export interface AppConfig {
  geminiApiKey: string;
  cloudflareApiToken: string;
  cloudflareAccountId: string;
  telegramBotToken: string;
  telegramWebhookSecret: string;
  telegramOwnerId?: string;
  geminiModel: string;
  agentMaxIterations: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  environment: 'development' | 'production' | 'test';
  adminSecret?: string;
}
