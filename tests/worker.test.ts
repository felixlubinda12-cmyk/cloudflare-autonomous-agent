import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../src/index.js';
import { MockKVNamespace, MockD1Database, MockR2Bucket } from './mocks.js';
import { Env } from '../src/types/env.js';

describe('Worker Endpoints (/ and /health)', () => {
  let mockEnv: Env;
  const mockCtx: ExecutionContext = {
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as any;

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
  });

  it('GET / returns operational metadata', async () => {
    const req = new Request('https://worker.dev/', { method: 'GET' });
    const res = await worker.fetch(req, mockEnv, mockCtx);
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.name).toBe('Cloudflare Autonomous Agent');
    expect(data.phase).toBe('Phase 1');
    expect(data.endpoints.health).toBe('GET /health');
  });

  it('GET /health reports healthy status without exposing secrets', async () => {
    const req = new Request('https://worker.dev/health', { method: 'GET' });
    const res = await worker.fetch(req, mockEnv, mockCtx);
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.status).toBe('healthy');
    expect(data.version).toBe('1.0.0');
    expect(data.services.gemini).toBe('configured');
    expect(data.services.cloudflare).toBe('configured');
    expect(data.services.telegram).toBe('configured');
    expect(data.services.d1).toBe('healthy');
    expect(data.services.kv).toBe('healthy');

    // Ensure secrets are never exposed in JSON output
    const jsonStr = JSON.stringify(data);
    expect(jsonStr).not.toContain('test-gemini-key');
    expect(jsonStr).not.toContain('test-cf-token');
    expect(jsonStr).not.toContain('test-bot-token');
    expect(jsonStr).not.toContain('super-secret-token');
  });

  it('GET /health reports degraded when secrets are missing', async () => {
    const brokenEnv = { ...mockEnv, GEMINI_API_KEY: '' };
    const req = new Request('https://worker.dev/health', { method: 'GET' });
    const res = await worker.fetch(req, brokenEnv, mockCtx);
    expect(res.status).toBe(503);
    const data = (await res.json()) as any;
    expect(data.status).toBe('degraded');
    expect(data.services.gemini).toBe('missing');
  });
});
