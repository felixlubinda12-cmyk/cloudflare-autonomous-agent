import { Session } from '../sessions/types.js';
import { SessionService } from '../sessions/service.js';
import { MemoryService } from '../memory/service.js';
import { CloudflareService } from '../cloudflare/client.js';
import { GeminiService } from '../gemini/client.js';
import { KvService } from '../storage/kv.js';
import { R2Service } from '../storage/r2.js';
import { D1Service } from '../storage/d1.js';
import { ToolRegistry } from '../tools/registry.js';
import { ToolExecutionContext } from '../tools/types.js';
import { ContextBuilder } from './context.js';
import { AgentLoop } from './loop.js';
import { Logger } from '../logging/logger.js';

export class AgentService {
  private sessions: SessionService;
  private memory: MemoryService;
  private cloudflare: CloudflareService;
  private kv: KvService;
  private r2: R2Service;
  private d1: D1Service;
  private tools: ToolRegistry;
  private contextBuilder: ContextBuilder;
  private agentLoop: AgentLoop;
  private logger: Logger;

  constructor(params: {
    sessions: SessionService;
    memory: MemoryService;
    cloudflare: CloudflareService;
    gemini: GeminiService;
    kv: KvService;
    r2: R2Service;
    d1: D1Service;
    accountId: string;
    maxIterations?: number;
    logger?: Logger;
  }) {
    this.sessions = params.sessions;
    this.memory = params.memory;
    this.cloudflare = params.cloudflare;
    this.kv = params.kv;
    this.r2 = params.r2;
    this.d1 = params.d1;
    this.logger = params.logger || new Logger();

    this.tools = new ToolRegistry();
    const maxIterations = params.maxIterations || 8;
    this.contextBuilder = new ContextBuilder(
      this.sessions,
      this.memory,
      params.accountId,
      maxIterations
    );
    this.agentLoop = new AgentLoop(
      params.gemini,
      this.tools,
      this.d1,
      maxIterations,
      this.logger
    );
  }

  /**
   * Main entry point to process a user's natural language request.
   */
  public async handleUserMessage(
    session: Session,
    userText: string
  ): Promise<string> {
    const trimmed = userText.trim();
    if (!trimmed) {
      return 'Please send a non-empty message.';
    }

    // 1. Persist user message to D1
    await this.sessions.addMessage(session.id, 'user', trimmed);

    // 2. Build context
    const context = await this.contextBuilder.build(session.id, trimmed);

    // 3. Prepare tool execution context
    const toolContext: ToolExecutionContext = {
      cloudflare: this.cloudflare,
      memory: this.memory,
      sessions: this.sessions,
      r2: this.r2,
      kv: this.kv,
      sessionId: session.id,
    };

    // 4. Run agent loop
    const loopResult = await this.agentLoop.run(
      session.id,
      trimmed,
      context.systemInstruction,
      context.contents,
      toolContext
    );

    // 5. Persist assistant response to D1
    await this.sessions.addMessage(session.id, 'assistant', loopResult.response, {
      runId: loopResult.runId,
      iterations: loopResult.iterations,
      status: loopResult.status,
    });

    return loopResult.response;
  }
}
