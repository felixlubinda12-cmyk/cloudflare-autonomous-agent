import { describe, it, expect } from 'vitest';
import { getAppConfig, ConfigurationError } from '../src/config/env.js';

describe('Configuration & Environment Validation', () => {
  it('throws ConfigurationError when required secrets are missing', () => {
    expect(() => getAppConfig({})).toThrow(ConfigurationError);
    try {
      getAppConfig({});
    } catch (e: any) {
      expect(e).toBeInstanceOf(ConfigurationError);
      expect(e.missingKeys).toContain('GEMINI_API_KEY');
      expect(e.missingKeys).toContain('CLOUDFLARE_API_TOKEN');
      expect(e.missingKeys).toContain('TELEGRAM_BOT_TOKEN');
      expect(e.missingKeys).toContain('TELEGRAM_WEBHOOK_SECRET');
    }
  });

  it('correctly loads and defaults valid configuration', () => {
    const config = getAppConfig({
      GEMINI_API_KEY: 'test-gemini-key',
      CLOUDFLARE_API_TOKEN: 'test-cf-token',
      TELEGRAM_BOT_TOKEN: '123456:test-bot-token',
      TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
    });
    expect(config.geminiApiKey).toBe('test-gemini-key');
    expect(config.cloudflareApiToken).toBe('test-cf-token');
    expect(config.telegramBotToken).toBe('123456:test-bot-token');
    expect(config.telegramWebhookSecret).toBe('test-webhook-secret');
    expect(config.cloudflareAccountId).toBe('7acc438ecf125d6eac5e140bcfb70d4f');
    expect(config.geminiModel).toBe('gemini-3.8-flash');
    expect(config.agentMaxIterations).toBe(8);
    expect(config.logLevel).toBe('info');
  });

  it('allows overriding account ID, model, and max iterations', () => {
    const config = getAppConfig({
      GEMINI_API_KEY: 'test-gemini-key',
      CLOUDFLARE_API_TOKEN: 'test-cf-token',
      TELEGRAM_BOT_TOKEN: '123456:test-bot-token',
      TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
      CLOUDFLARE_ACCOUNT_ID: 'custom-account-123',
      GEMINI_MODEL: 'gemini-3.1-pro-preview',
      AGENT_MAX_ITERATIONS: '5',
      LOG_LEVEL: 'debug',
      TELEGRAM_OWNER_ID: '987654321',
    });
    expect(config.cloudflareAccountId).toBe('custom-account-123');
    expect(config.geminiModel).toBe('gemini-3.1-pro-preview');
    expect(config.agentMaxIterations).toBe(5);
    expect(config.logLevel).toBe('debug');
    expect(config.telegramOwnerId).toBe('987654321');
  });
});
