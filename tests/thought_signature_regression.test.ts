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
import { GeminiContent } from '../src/gemini/types.js';

describe('Gemini 3 Function Calling Thought Signature Regression Suite', () => {
  let mockD1: MockD1Database;
  let d1: D1Service;
  let tools: ToolRegistry;
  let toolContext: ToolExecutionContext;

  beforeEach(() => {
    mockD1 = new MockD1Database();
    d1 = new D1Service(mockD1 as any);
    tools = new ToolRegistry();
    toolContext = {
      cloudflare: new CloudflareService('mock-cf-token', 'mock-account-id'),
      memory: new MemoryService(d1),
      sessions: new SessionService(d1),
      r2: new R2Service(new MockR2Bucket() as any),
      kv: new KvService(new MockKVNamespace() as any),
      sessionId: 'session-thought-sig-test',
    };
  });

  it('preserves thought_signature on candidate part into the subsequent Gemini request', async () => {
    const gemini = new GeminiService('test-key');

    const sampleThoughtSig = 'EosBCogBCkQKFWdlbWluaS0yLjUtZmxhc2gtdGhvdWdodC1zaWduYXR1cmUtYmxvYi1leGFtcGxl';

    const recordedRequests: Array<{ contents: GeminiContent[] }> = [];

    // First call returns functionCall with thought_signature
    const generateSpy = vi.spyOn(gemini, 'generateContent')
      .mockImplementation(async (params) => {
        recordedRequests.push({ contents: JSON.parse(JSON.stringify(params.contents)) });

        if (recordedRequests.length === 1) {
          return {
            candidateParts: [
              {
                thought: true,
                text: 'I should list workers to see what is currently deployed.',
              },
              {
                thought_signature: sampleThoughtSig,
                functionCall: {
                  name: 'cloudflare_list_workers',
                  args: {},
                },
              },
            ],
            toolCalls: [
              {
                name: 'cloudflare_list_workers',
                args: {},
                thought_signature: sampleThoughtSig,
                thoughtSignature: sampleThoughtSig,
                part: {
                  thought_signature: sampleThoughtSig,
                  functionCall: {
                    name: 'cloudflare_list_workers',
                    args: {},
                  },
                },
              },
            ],
          };
        } else {
          return {
            candidateParts: [
              {
                text: 'Found 1 worker: auth-worker.',
              },
            ],
            text: 'Found 1 worker: auth-worker.',
          };
        }
      });

    vi.spyOn(toolContext.cloudflare, 'listWorkers').mockResolvedValueOnce([
      { id: 'auth-worker', created_on: '2026-09-01', modified_on: '2026-09-02' },
    ]);

    const loop = new AgentLoop(gemini, tools, d1, 5);
    const result = await loop.run(
      'session-thought-sig-test',
      'List my workers',
      'System prompt',
      [{ role: 'user', parts: [{ text: 'List my workers' }] }],
      toolContext
    );

    expect(result.status).toBe('completed');
    expect(result.iterations).toBe(2);
    expect(result.response).toBe('Found 1 worker: auth-worker.');
    expect(generateSpy).toHaveBeenCalledTimes(2);

    // CRITICAL ASSERTION: The 2nd Gemini request MUST include the model's turn with thought_signature
    expect(recordedRequests.length).toBe(2);
    const secondReqContents = recordedRequests[1].contents;

    // Structure of contents in second request:
    // [0] user: "List my workers"
    // [1] model: parts with functionCall AND thought_signature intact
    // [2] user/function: parts with functionResponse
    expect(secondReqContents.length).toBe(3);

    const modelTurn = secondReqContents[1];
    expect(modelTurn.role).toBe('model');

    // Find functionCall part
    const functionCallPart = modelTurn.parts.find((p) => p.functionCall?.name === 'cloudflare_list_workers');
    expect(functionCallPart).toBeDefined();

    // Verify thought_signature is preserved
    const preservedSig = (functionCallPart as any).thought_signature || (functionCallPart as any).thoughtSignature;
    expect(preservedSig).toBe(sampleThoughtSig);

    // Verify user turn with functionResponse is present
    const toolResponseTurn = secondReqContents[2];
    expect(toolResponseTurn.role).toBe('user');
    expect(toolResponseTurn.parts[0].functionResponse?.name).toBe('cloudflare_list_workers');
  });

  it('preserves thought_signature across multi-step sequential tool calls', async () => {
    const gemini = new GeminiService('test-key');

    const sigStep1 = 'sig-step-1-blob-1234567890';
    const sigStep2 = 'sig-step-2-blob-0987654321';

    const recordedRequests: Array<{ contents: GeminiContent[] }> = [];

    vi.spyOn(gemini, 'generateContent').mockImplementation(async (params) => {
      recordedRequests.push({ contents: JSON.parse(JSON.stringify(params.contents)) });

      if (recordedRequests.length === 1) {
        // Step 1: list workers
        return {
          candidateParts: [
            {
              thought_signature: sigStep1,
              functionCall: {
                name: 'cloudflare_list_workers',
                args: {},
              },
            },
          ],
          toolCalls: [
            {
              name: 'cloudflare_list_workers',
              args: {},
              thought_signature: sigStep1,
            },
          ],
        };
      } else if (recordedRequests.length === 2) {
        // Step 2: save memory
        return {
          candidateParts: [
            {
              thought_signature: sigStep2,
              functionCall: {
                name: 'memory_save',
                args: { key: 'last_worker_count', content: '1' },
              },
            },
          ],
          toolCalls: [
            {
              name: 'memory_save',
              args: { key: 'last_worker_count', content: '1' },
              thought_signature: sigStep2,
            },
          ],
        };
      } else {
        // Final response
        return {
          candidateParts: [{ text: 'Listed workers and saved count to memory.' }],
          text: 'Listed workers and saved count to memory.',
        };
      }
    });

    vi.spyOn(toolContext.cloudflare, 'listWorkers').mockResolvedValueOnce([
      { id: 'auth-worker', created_on: '2026-09-01' },
    ]);

    const loop = new AgentLoop(gemini, tools, d1, 5);
    const result = await loop.run(
      'session-thought-sig-test',
      'List workers and save count',
      'System prompt',
      [{ role: 'user', parts: [{ text: 'List workers and save count' }] }],
      toolContext
    );

    expect(result.status).toBe('completed');
    expect(result.iterations).toBe(3);
    expect(recordedRequests.length).toBe(3);

    // Verify step 3 request has both previous tool calls with their respective signatures preserved
    const step3Contents = recordedRequests[2].contents;

    // [0] user
    // [1] model (step 1 with sigStep1)
    // [2] user response (step 1)
    // [3] model (step 2 with sigStep2)
    // [4] user response (step 2)
    expect(step3Contents.length).toBe(5);

    const modelStep1 = step3Contents[1];
    const fcPart1 = modelStep1.parts.find((p) => p.functionCall?.name === 'cloudflare_list_workers');
    expect((fcPart1 as any).thought_signature).toBe(sigStep1);

    const modelStep2 = step3Contents[3];
    const fcPart2 = modelStep2.parts.find((p) => p.functionCall?.name === 'memory_save');
    expect((fcPart2 as any).thought_signature).toBe(sigStep2);
  });

  it('GeminiService REST client parses candidateParts with thought_signature without dropping them', async () => {
    const service = new GeminiService('dummy-api-key');

    const sampleThoughtSig = 'AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA=';
    const fakeApiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                thought: true,
                text: 'Thinking through the request...',
              },
              {
                thought_signature: sampleThoughtSig,
                functionCall: {
                  name: 'cloudflare_get_subdomain',
                  args: {},
                },
              },
            ],
          },
          finishReason: 'STOP',
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => fakeApiResponse,
    });

    const response = await service.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'What is my subdomain?' }] }],
    });

    expect(response.candidateParts).toBeDefined();
    expect(response.candidateParts?.length).toBe(2);
    expect((response.candidateParts?.[1] as any).thought_signature).toBe(sampleThoughtSig);

    expect(response.toolCalls).toBeDefined();
    expect(response.toolCalls?.length).toBe(1);
    expect(response.toolCalls?.[0].name).toBe('cloudflare_get_subdomain');
    expect(response.toolCalls?.[0].thought_signature).toBe(sampleThoughtSig);
  });
});
