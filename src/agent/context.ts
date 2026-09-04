import { GeminiContent } from '../gemini/types.js';
import { SessionService } from '../sessions/service.js';
import { MemoryService } from '../memory/service.js';
import { buildSystemPrompt } from './systemPrompt.js';

export interface BuiltContext {
  systemInstruction: string;
  contents: GeminiContent[];
}

export class ContextBuilder {
  private sessions: SessionService;
  private memory: MemoryService;
  private accountId: string;
  private maxIterations: number;
  private githubRepo?: string;

  constructor(
    sessions: SessionService,
    memory: MemoryService,
    accountId: string,
    maxIterations: number = 8,
    githubRepo?: string
  ) {
    this.sessions = sessions;
    this.memory = memory;
    this.accountId = accountId;
    this.maxIterations = maxIterations;
    this.githubRepo = githubRepo;
  }

  public setTargetRepository(githubRepo?: string): void {
    this.githubRepo = githubRepo;
  }

  /**
   * Assembles the complete context for a user turn.
   */
  public async build(
    sessionId: string,
    currentUserMessage: string
  ): Promise<BuiltContext> {
    const baseSystemPrompt = buildSystemPrompt({
      accountId: this.accountId,
      maxIterations: this.maxIterations,
      githubRepo: this.githubRepo,
    });

    // 1. Retrieve persistent memories
    const memories = await this.memory.listMemories(undefined, 15);
    let memoryBlock = '';
    if (memories.length > 0) {
      memoryBlock = '\n\nSTORED PERSISTENT MEMORIES:\n' +
        memories
          .map((m) => `- [${m.category}] ${m.key}: ${m.content}`)
          .join('\n');
    }

    const fullSystemInstruction = baseSystemPrompt + memoryBlock;

    // 2. Retrieve recent message history
    const recentMessages = await this.sessions.getRecentMessages(sessionId, 12);
    const contents: GeminiContent[] = [];

    for (const msg of recentMessages) {
      if (msg.role === 'user') {
        contents.push({
          role: 'user',
          parts: [{ text: msg.content }],
        });
      } else if (msg.role === 'assistant') {
        contents.push({
          role: 'model',
          parts: [{ text: msg.content }],
        });
      }
    }

    // 3. Add current turn user message
    contents.push({
      role: 'user',
      parts: [{ text: currentUserMessage }],
    });

    return {
      systemInstruction: fullSystemInstruction,
      contents,
    };
  }
}
