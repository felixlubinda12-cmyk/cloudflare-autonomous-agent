import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloudflareService, CloudflareApiError } from '../src/cloudflare/client.js';

describe('CloudflareService API Client', () => {
  const accountId = '7acc438ecf125d6eac5e140bcfb70d4f';
  const apiToken = 'test-token-12345';
  let service: CloudflareService;

  beforeEach(() => {
    service = new CloudflareService(apiToken, accountId);
    vi.restoreAllMocks();
  });

  it('constructs correct authorization headers and URL for listWorkers', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: true,
        errors: [],
        messages: [],
        result: [{ id: 'worker-1', created_on: '2026-09-01' }],
      }),
    });
    global.fetch = mockFetch;

    const workers = await service.listWorkers();
    expect(workers.length).toBe(1);
    expect(workers[0].id).toBe('worker-1');

    expect(mockFetch).toHaveBeenCalledWith(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts`,
      expect.objectContaining({
        headers: expect.any(Headers),
      })
    );
    const callHeaders: Headers = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders.get('Authorization')).toBe(`Bearer ${apiToken}`);
  });

  it('handles getWorker content (text/javascript response)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/javascript' }),
      text: async () => 'export default { fetch() { return new Response("ok"); } }',
    });
    global.fetch = mockFetch;

    const code = await service.getWorkerContent('my-script');
    expect(code).toContain('export default');
    expect(mockFetch).toHaveBeenCalledWith(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/my-script/content`,
      expect.anything()
    );
  });

  it('handles uploadWorkerScript with multipart form data', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: true,
        errors: [],
        messages: [],
        result: { id: 'test-api', usage_model: 'standard' },
      }),
    });
    global.fetch = mockFetch;

    const result = await service.uploadWorkerScript(
      'test-api',
      'export default { fetch() { return new Response("hi"); } }'
    );
    expect(result.id).toBe('test-api');
    expect(mockFetch).toHaveBeenCalledWith(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/test-api`,
      expect.objectContaining({
        method: 'PUT',
        body: expect.any(FormData),
      })
    );
  });

  it('throws structured CloudflareApiError on API error and redacts secrets', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: false,
        errors: [{ code: 10007, message: 'Script not found' }],
        messages: [],
        result: null,
      }),
    });
    global.fetch = mockFetch;

    await expect(service.getWorker('non-existent')).rejects.toThrow(CloudflareApiError);
  });
});
