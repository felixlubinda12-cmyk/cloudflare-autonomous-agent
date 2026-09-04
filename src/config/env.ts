import { Env, AppConfig } from '../types/env.js';

export const DEFAULT_CLOUDFLARE_ACCOUNT_ID = '7acc438ecf125d6eac5e140bcfb70d4f';
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
export const DEFAULT_AGENT_MAX_ITERATIONS = 8;
export const DEFAULT_LOG_LEVEL = 'info';

export class ConfigurationError extends Error {
  public missingKeys: string[];
  constructor(missingKeys: string[]) {
    super(`Missing required environment secrets/variables: ${missingKeys.join(', ')}`);
    this.name = 'ConfigurationError';
    this.missingKeys = missingKeys;
  }
}

/**
 * Validates and extracts typed configuration from Cloudflare Worker Env.
 * Throws ConfigurationError if required secrets are absent, without leaking values.
 */
export function getAppConfig(env: Partial<Env>): AppConfig {
  const missing: string[] = [];

  if (!env.GEMINI_API_KEY || env.GEMINI_API_KEY.trim() === '') {
    missing.push('GEMINI_API_KEY');
  }
  if (!env.CLOUDFLARE_API_TOKEN || env.CLOUDFLARE_API_TOKEN.trim() === '') {
    missing.push('CLOUDFLARE_API_TOKEN');
  }
  if (!env.TELEGRAM_BOT_TOKEN || env.TELEGRAM_BOT_TOKEN.trim() === '') {
    missing.push('TELEGRAM_BOT_TOKEN');
  }
  if (!env.TELEGRAM_WEBHOOK_SECRET || env.TELEGRAM_WEBHOOK_SECRET.trim() === '') {
    missing.push('TELEGRAM_WEBHOOK_SECRET');
  }

  if (missing.length > 0) {
    throw new ConfigurationError(missing);
  }

  const cloudflareAccountId = (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_ACCOUNT_ID.trim())
    ? env.CLOUDFLARE_ACCOUNT_ID.trim()
    : DEFAULT_CLOUDFLARE_ACCOUNT_ID;

  const rawIterations = parseInt(env.AGENT_MAX_ITERATIONS || '', 10);
  const agentMaxIterations = (!isNaN(rawIterations) && rawIterations > 0 && rawIterations <= 20)
    ? rawIterations
    : DEFAULT_AGENT_MAX_ITERATIONS;

  const validLogLevels: AppConfig['logLevel'][] = ['debug', 'info', 'warn', 'error'];
  const logLevelCandidate = (env.LOG_LEVEL?.toLowerCase() || DEFAULT_LOG_LEVEL) as AppConfig['logLevel'];
  const logLevel = validLogLevels.includes(logLevelCandidate) ? logLevelCandidate : 'info';

  const validEnvs: AppConfig['environment'][] = ['development', 'production', 'test'];
  const envCandidate = (env.ENVIRONMENT?.toLowerCase() || 'production') as AppConfig['environment'];
  const environment = validEnvs.includes(envCandidate) ? envCandidate : 'production';

  return {
    geminiApiKey: env.GEMINI_API_KEY!.trim(),
    cloudflareApiToken: env.CLOUDFLARE_API_TOKEN!.trim(),
    cloudflareAccountId,
    telegramBotToken: env.TELEGRAM_BOT_TOKEN!.trim(),
    telegramWebhookSecret: env.TELEGRAM_WEBHOOK_SECRET!.trim(),
    telegramOwnerId: env.TELEGRAM_OWNER_ID ? env.TELEGRAM_OWNER_ID.trim() : undefined,
    geminiModel: env.GEMINI_MODEL ? env.GEMINI_MODEL.trim() : DEFAULT_GEMINI_MODEL,
    agentMaxIterations,
    logLevel,
    environment,
    adminSecret: env.ADMIN_SECRET ? env.ADMIN_SECRET.trim() : undefined,
    geminiFallbackApiKey: (env.GEMINI_FALLBACK_API_KEY && env.GEMINI_FALLBACK_API_KEY.trim())
      ? env.GEMINI_FALLBACK_API_KEY.trim()
      : undefined,
    githubToken: (env.GITHUB_TOKEN && env.GITHUB_TOKEN.trim())
      ? env.GITHUB_TOKEN.trim()
      : undefined,
    githubOwner: (env.GITHUB_OWNER && env.GITHUB_OWNER.trim())
      ? env.GITHUB_OWNER.trim()
      : undefined,
    githubRepository: (env.GITHUB_REPOSITORY && env.GITHUB_REPOSITORY.trim())
      ? env.GITHUB_REPOSITORY.trim()
      : undefined,
  };
}
