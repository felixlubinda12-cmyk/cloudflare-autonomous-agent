import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentLoop } from '../src/agent/loop.js';
import { GeminiService } from '../src/gemini/client.js';
import { ToolRegistry } from '../src/tools/registry.js';
import { ToolExecutionContext } from '../src/tools/types.js';
import { MockD1Database, MockKVNamespace, MockR2Bucket } from './mocks.js';
import { D1Service } from '../src/storage/d1.js';
import { CloudflareService } from '../src/cloudflare/client.js';
import { MemoryService } from '../src/memory/service.js';
import { SessionService } from '../src/sessions/service.js';
import { R2Service } from '../src/storage/r2.js';
import { KvService } from '../src/storage/kv.js';

describe('Agent Loop & Multi-step Execution', () => {
  let mockD1: MockD1Database;
  let d1: D1Service;
  let tools: ToolRegistry;
  let toolContext: ToolExecutionContext;

  beforeEach(() => {
    mockD1 = new MockD1Database();
    d1 = new D1Service(mockD1 as any);
    tools = new ToolRegistry();
    toolContext = {
      cloudflare: new CloudflareService('token', 'account'),
      memory: new MemoryService(d1),
      sessions: new SessionService(d1),
      r2: new R2Service(new MockR2Bucket() as any),
      kv: new KvService(new MockKVNamespace() as any),
      sessionId: 'session-test',
    };
  });

  it('handles final response without tools (one-shot answer)', async () => {
    const gemini = new GeminiService('key');
    vi.spyOn(gemini, 'generateContent').mockResolvedValueOnce({
      text: 'Hello! How can I help you today?',
    });
    const loop = new AgentLoop(gemini, tools, d1, 5);
    const result = await loop.run(
      'session-test',
      'Hello',
      'System prompt',
      [{ role: 'user', parts: [{ text: 'Hello' }] }],
      toolContext
    );
    expect(result.status).toBe('completed');
    expect(result.iterations).toBe(1);
    expect(result.response).toBe('Hello! How can I help you today?');
  });

  it('handles single tool call and follows up with reasoning', async () => {
    const gemini = new GeminiService('key');
    const generateSpy = vi.spyOn(gemini, 'generateContent')
      .mockResolvedValueOnce({
        toolCalls: [
          {
            name: 'memory_save',
            args: { key: 'lang', content: 'TypeScript' },
          },
        ],
      })
      .mockResolvedValueOnce({
        text: 'I have saved your language preference as TypeScript.',
      });

    const loop = new AgentLoop(gemini, tools, d1, 5);
    const result = await loop.run(
      'session-test',
      'Remember my language is TypeScript',
      'System prompt',
      [{ role: 'user', parts: [{ text: 'Remember my language is TypeScript' }] }],
      toolContext
    );

    expect(result.status).toBe('completed');
    expect(result.iterations).toBe(2);
    expect(result.response).toBe('I have saved your language preference as TypeScript.');
    expect(generateSpy).toHaveBeenCalledTimes(2);
    // Verify D1 tool_calls recorded audit row
    expect(mockD1.tables.get('tool_calls')?.length).toBe(1);
    expect(mockD1.tables.get('tool_calls')?.[0].tool_name).toBe('memory_save');
  });

  it('handles multiple sequential tool calls', async () => {
    const gemini = new GeminiService('key');
    vi.spyOn(gemini, 'generateContent')
      .mockResolvedValueOnce({
        toolCalls: [
          {
            name: 'memory_save',
            args: { key: 'site', content: 'example.com' },
          },
        ],
      })
      .mockResolvedValueOnce({
        toolCalls: [
          {
            name: 'memory_search',
            args: { query: 'site' },
          },
        ],
      })
      .mockResolvedValueOnce({
        text: 'Found saved site memory: example.com.',
      });

    const loop = new AgentLoop(gemini, tools, d1, 5);
    const result = await loop.run(
      'session-test',
      'Save site and verify it',
      'System prompt',
      [{ role: 'user', parts: [{ text: 'Save site and verify it' }] }],
      toolContext
    );

    expect(result.status).toBe('completed');
    expect(result.iterations).toBe(3);
    expect(result.response).toBe('Found saved site memory: example.com.');
    expect(mockD1.tables.get('tool_calls')?.length).toBe(2);
  });

  it('handles tool execution error gracefully and feeds error back to model', async () => {
    const gemini = new GeminiService('key');
    vi.spyOn(gemini, 'generateContent')
      .mockResolvedValueOnce({
        toolCalls: [
          {
            name: 'cloudflare_get_worker',
            args: { script_name: 'missing-worker' },
          },
        ],
      })
      .mockResolvedValueOnce({
        text: 'The worker "missing-worker" was not found in your account.',
      });

    vi.spyOn(toolContext.cloudflare, 'getWorker').mockRejectedValueOnce(
      new Error('Worker not found')
    );

    const loop = new AgentLoop(gemini, tools, d1, 5);
    const result = await loop.run(
      'session-test',
      'Inspect missing-worker',
      'System prompt',
      [{ role: 'user', parts: [{ text: 'Inspect missing-worker' }] }],
      toolContext
    );

    expect(result.status).toBe('completed');
    expect(result.response).toBe('The worker "missing-worker" was not found in your account.');
    expect(mockD1.tables.get('tool_calls')?.[0].is_error).toBe(1);
  });

  it('enforces maximum iteration limit to prevent infinite loops', async () => {
    const gemini = new GeminiService('key');
    // Continually returns tool calls
    vi.spyOn(gemini, 'generateContent').mockResolvedValue({
      toolCalls: [
        {
          name: 'memory_list',
          args: {},
        },
      ],
    });

    const loop = new AgentLoop(gemini, tools, d1, 3);
    const result = await loop.run(
      'session-test',
      'Loop forever',
      'System prompt',
      [{ role: 'user', parts: [{ text: 'Loop forever' }] }],
      toolContext
    );

    expect(result.status).toBe('max_iterations');
    expect(result.iterations).toBe(3);
    expect(result.response).toContain('maximum iteration limit');
  });

  it('handles malformed / unknown tool call from Gemini', async () => {
    const gemini = new GeminiService('key');
    vi.spyOn(gemini, 'generateContent')
      .mockResolvedValueOnce({
        toolCalls: [
          {
            name: 'invented_fake_tool',
            args: { foo: 'bar' },
          },
        ],
      })
      .mockResolvedValueOnce({
        text: 'I apologize, that tool is not available.',
      });

    const loop = new AgentLoop(gemini, tools, d1, 5);
    const result = await loop.run(
      'session-test',
      'Do fake action',
      'System prompt',
      [{ role: 'user', parts: [{ text: 'Do fake action' }] }],
      toolContext
    );

    expect(result.status).toBe('completed');
    expect(result.response).toBe('I apologize, that tool is not available.');
    expect(mockD1.tables.get('tool_calls')?.[0].is_error).toBe(1);
  });
});
