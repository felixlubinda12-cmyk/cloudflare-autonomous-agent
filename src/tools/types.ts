import { CloudflareService } from '../cloudflare/client.js';
import { MemoryService } from '../memory/service.js';
import { SessionService } from '../sessions/service.js';
import { R2Service } from '../storage/r2.js';
import { KvService } from '../storage/kv.js';
import { GitHubService } from '../github/client.js';

export interface ToolExecutionContext {
  cloudflare: CloudflareService;
  memory: MemoryService;
  sessions: SessionService;
  r2: R2Service;
  kv: KvService;
  sessionId: string;
  runId?: string;
  github?: GitHubService;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface JsonSchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

export interface ToolJsonSchema {
  type: 'object';
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
  description?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolJsonSchema;
  isDestructive?: boolean;
  execute: (
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ) => Promise<ToolResult>;
}
