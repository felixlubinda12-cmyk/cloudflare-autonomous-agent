import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolRegistry } from '../src/tools/registry.js';
import { ToolExecutionContext } from '../src/tools/types.js';
import { MockKVNamespace, MockD1Database, MockR2Bucket } from './mocks.js';
import { CloudflareService } from '../src/cloudflare/client.js';
import { MemoryService } from '../src/memory/service.js';
import { SessionService } from '../src/sessions/service.js';
import { R2Service } from '../src/storage/r2.js';
import { KvService } from '../src/storage/kv.js';
import { D1Service } from '../src/storage/d1.js';

describe('ToolRegistry & Tool Execution', () => {
  let registry: ToolRegistry;
  let context: ToolExecutionContext;

  beforeEach(() => {
    registry = new ToolRegistry();
    const d1 = new D1Service(new MockD1Database() as any);
    context = {
      cloudflare: new CloudflareService('test-token', 'test-account'),
      memory: new MemoryService(d1),
      sessions: new SessionService(d1),
      r2: new R2Service(new MockR2Bucket() as any),
      kv: new KvService(new MockKVNamespace() as any),
      sessionId: 'session-123',
    };
  });

  it('registers all standard Phase 1 tools and outputs function declarations', () => {
    const declarations = registry.getFunctionDeclarations();
    const names = declarations.map((d) => d.name);
    expect(names).toContain('cloudflare_list_workers');
    expect(names).toContain('cloudflare_get_worker');
    expect(names).toContain('cloudflare_get_worker_code');
    expect(names).toContain('cloudflare_create_worker');
    expect(names).toContain('cloudflare_update_worker');
    expect(names).toContain('cloudflare_delete_worker');
    expect(names).toContain('cloudflare_get_worker_deployments');
    expect(names).toContain('cloudflare_get_subdomain');
    expect(names).toContain('memory_save');
    expect(names).toContain('memory_search');
    expect(names).toContain('memory_list');
    expect(names).toContain('memory_delete');
  });

  it('rejects unknown tools safely', async () => {
    const res = await registry.execute('unknown_tool', {}, context);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Unknown tool');
  });

  it('validates missing required arguments before execution', async () => {
    const res = await registry.execute('cloudflare_get_worker', {}, context);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Missing required argument "script_name"');
  });

  it('executes memory_save tool and returns success', async () => {
    const res = await registry.execute(
      'memory_save',
      { key: 'framework', content: 'Hono on Cloudflare' },
      context
    );
    expect(res.success).toBe(true);
    expect((res.data as any).message).toContain('saved successfully');
  });
});
