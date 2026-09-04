import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleTelegramWebhook } from '../src/telegram/webhook.js';
import { MockKVNamespace, MockD1Database, MockR2Bucket } from './mocks.js';
import { Env } from '../src/types/env.js';

describe('Telegram Webhook Handler', () => {
  let mockEnv: Env;

  beforeEach(() => {
    mockEnv = {
      AGENT_KV: new MockKVNamespace() as any,
      AGENT_DB: new MockD1Database() as any,
      AGENT_STORAGE: new MockR2Bucket() as any,
      GEMINI_API_KEY: 'test-gemini-key',
      CLOUDFLARE_API_TOKEN: 'test-cf-token',
      TELEGRAM_BOT_TOKEN: '12345:test-bot-token',
      TELEGRAM_WEBHOOK_SECRET: 'super-secret-token',
      TELEGRAM_OWNER_ID: '12345678',
      CLOUDFLARE_ACCOUNT_ID: '7acc438ecf125d6eac5e140bcfb70d4f',
    };

    // Mock fetch for Telegram API calls
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ ok: true, result: true }),
    });
  });

  it('rejects unauthorized requests with 401 when secret header is missing or invalid', async () => {
    const req = new Request('https://worker.dev/webhooks/telegram', {
      method: 'POST',
      headers: {
        'X-Telegram-Bot-Api-Secret-Token': 'wrong-secret',
      },
      body: JSON.stringify({ update_id: 1 }),
    });
    const res = await handleTelegramWebhook(req, mockEnv);
    expect(res.status).toBe(401);
  });

  it('handles /start command deterministically without invoking Gemini', async () => {
    const req = new Request('https://worker.dev/webhooks/telegram', {
      method: 'POST',
      headers: {
        'X-Telegram-Bot-Api-Secret-Token': 'super-secret-token',
      },
      body: JSON.stringify({
        update_id: 100,
        message: {
          message_id: 1,
          from: { id: 12345678, is_bot: false, first_name: 'Owner' },
          chat: { id: 12345678, type: 'private' },
          text: '/start',
        },
      }),
    });
    const res = await handleTelegramWebhook(req, mockEnv);
    expect(res.status).toBe(200);
    // Verify Telegram sendMessage was called with welcome text
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/sendMessage'),
      expect.objectContaining({
        body: expect.stringContaining('Cloudflare Autonomous Agent'),
      })
    );
  });

  it('enforces idempotency and skips duplicate updates', async () => {
    const makeReq = () =>
      new Request('https://worker.dev/webhooks/telegram', {
        method: 'POST',
        headers: {
          'X-Telegram-Bot-Api-Secret-Token': 'super-secret-token',
        },
        body: JSON.stringify({
          update_id: 200,
          message: {
            message_id: 2,
            from: { id: 12345678, is_bot: false, first_name: 'Owner' },
            chat: { id: 12345678, type: 'private' },
            text: '/help',
          },
        }),
      });

    // First call processes
    const res1 = await handleTelegramWebhook(makeReq(), mockEnv);
    expect(res1.status).toBe(200);
    const fetchCount1 = vi.mocked(global.fetch).mock.calls.length;

    // Second call with same update_id should skip
    const res2 = await handleTelegramWebhook(makeReq(), mockEnv);
    expect(res2.status).toBe(200);
    const fetchCount2 = vi.mocked(global.fetch).mock.calls.length;
    expect(fetchCount2).toBe(fetchCount1); // No new Telegram API call made
  });

  it('rejects unauthorized Telegram users when owner ID is configured', async () => {
    const req = new Request('https://worker.dev/webhooks/telegram', {
      method: 'POST',
      headers: {
        'X-Telegram-Bot-Api-Secret-Token': 'super-secret-token',
      },
      body: JSON.stringify({
        update_id: 300,
        message: {
          message_id: 3,
          from: { id: 99999999, is_bot: false, first_name: 'Intruder' },
          chat: { id: 99999999, type: 'private' },
          text: 'List my workers',
        },
      }),
    });
    const res = await handleTelegramWebhook(req, mockEnv);
    expect(res.status).toBe(200);
    // Verify rejection sent
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/sendMessage'),
      expect.objectContaining({
        body: expect.stringContaining('Unauthorized'),
      })
    );
  });
});
