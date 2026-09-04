import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiService, GeminiApiError } from '../src/gemini/client.js';
import { SecretRedactor } from '../src/security/secrets.js';

describe('Gemini Fallback API Key Suite', () => {
  const primaryKey = 'AIzaSyPrimaryTestKey1234567890';
  const fallbackKey = 'AIzaSyFallbackTestKey0987654321';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uses primary key when primary request succeeds and does not invoke fallback', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      expect(url).toContain(primaryKey);
      expect(url).not.toContain(fallbackKey);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'Response from primary key' }],
              },
              finishReason: 'STOP',
            },
          ],
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const gemini = new GeminiService(primaryKey, 'gemini-3.8-flash', undefined, fallbackKey);
    const result = await gemini.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.text).toBe('Response from primary key');
  });

  it('rotates to fallback key when primary returns HTTP 429 quota exhausted', async () => {
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      callCount++;
      if (callCount === 1) {
        expect(url).toContain(primaryKey);
        return Promise.resolve({
          ok: false,
          status: 429,
          text: async () => JSON.stringify({ error: { message: 'RESOURCE_EXHAUSTED' } }),
        });
      }
      expect(url).toContain(fallbackKey);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'Response from fallback key' }],
              },
              finishReason: 'STOP',
            },
          ],
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const gemini = new GeminiService(primaryKey, 'gemini-3.8-flash', undefined, fallbackKey);
    const result = await gemini.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Quota test' }] }],
    });

    expect(callCount).toBe(2);
    expect(result.text).toBe('Response from fallback key');
  });

  it('rotates to fallback key when primary returns HTTP 503 service unavailable', async () => {
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      callCount++;
      if (callCount === 1) {
        expect(url).toContain(primaryKey);
        return Promise.resolve({
          ok: false,
          status: 503,
          text: async () => 'Service Temporarily Unavailable',
        });
      }
      expect(url).toContain(fallbackKey);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'Recovered via fallback key' }],
              },
            },
          ],
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const gemini = new GeminiService(primaryKey, 'gemini-3.8-flash', undefined, fallbackKey);
    const result = await gemini.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Server error test' }] }],
    });

    expect(callCount).toBe(2);
    expect(result.text).toBe('Recovered via fallback key');
  });

  it('does NOT blindly rotate keys for authentication errors (HTTP 401/403)', async () => {
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      callCount++;
      expect(url).toContain(primaryKey);
      return Promise.resolve({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: { message: 'API_KEY_INVALID' } }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const gemini = new GeminiService(primaryKey, 'gemini-3.8-flash', undefined, fallbackKey);

    await expect(
      gemini.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'Auth error' }] }],
      })
    ).rejects.toThrow(GeminiApiError);

    // Verifies key was NOT switched to fallback on auth error
    expect(callCount).toBe(1);
  });

  it('throws an informative error if both primary and fallback keys fail', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes(primaryKey)) {
        return Promise.resolve({
          ok: false,
          status: 429,
          text: async () => 'Primary Rate limit',
        });
      }
      return Promise.resolve({
        ok: false,
        status: 429,
        text: async () => 'Fallback Rate limit',
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const gemini = new GeminiService(primaryKey, 'gemini-3.8-flash', undefined, fallbackKey);

    await expect(
      gemini.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'Double quota failure' }] }],
      })
    ).rejects.toThrow(/primary key failed.*fallback key failed/i);
  });

  it('preserves thought_signatures and function calls when served by fallback key', async () => {
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 429,
          text: async () => 'Overloaded',
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    thought: true,
                    text: 'Thinking in fallback mode...',
                  },
                  {
                    thought_signature: 'sig_fallback_thought_12345',
                    functionCall: {
                      name: 'github_list_contents',
                      args: { path: 'src' },
                    },
                  },
                ],
              },
              finishReason: 'STOP',
            },
          ],
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const gemini = new GeminiService(primaryKey, 'gemini-3.8-flash', undefined, fallbackKey);
    const result = await gemini.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'List repo src files' }] }],
    });

    expect(result.toolCalls).toBeDefined();
    expect(result.toolCalls?.length).toBe(1);
    expect(result.toolCalls?.[0].name).toBe('github_list_contents');
    expect(result.toolCalls?.[0].thought_signature).toBe('sig_fallback_thought_12345');
    expect(result.candidateParts).toBeDefined();
    expect((result.candidateParts?.[1] as any).thought_signature).toBe('sig_fallback_thought_12345');
  });

  it('redacts both primary and fallback keys from error outputs', async () => {
    const redactor = new SecretRedactor([primaryKey, fallbackKey]);
    const rawError = `Error with key ${primaryKey} and backup ${fallbackKey}`;
    const clean = redactor.redact(rawError);

    expect(clean).not.toContain(primaryKey);
    expect(clean).not.toContain(fallbackKey);
    expect(clean).toContain('[REDACTED_SECRET]');
  });
});
