import {
  ToolDefinition,
  ToolExecutionContext,
  ToolResult,
} from './types.js';
import {
  listWorkersTool,
  getWorkerTool,
  getWorkerCodeTool,
  createWorkerTool,
  updateWorkerTool,
  deleteWorkerTool,
  getWorkerDeploymentsTool,
} from './cloudflare/workers.js';
import { getSubdomainTool } from './cloudflare/account.js';
import {
  saveMemoryTool,
  searchMemoryTool,
  listMemoriesTool,
  deleteMemoryTool,
} from './memory/memory.js';

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  constructor() {
    // Register standard Phase 1 tools
    this.register(listWorkersTool);
    this.register(getWorkerTool);
    this.register(getWorkerCodeTool);
    this.register(createWorkerTool);
    this.register(updateWorkerTool);
    this.register(deleteWorkerTool);
    this.register(getWorkerDeploymentsTool);
    this.register(getSubdomainTool);
    this.register(saveMemoryTool);
    this.register(searchMemoryTool);
    this.register(listMemoriesTool);
    this.register(deleteMemoryTool);
  }

  public register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  public get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  public getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Generates function declarations formatted for the Gemini API.
   */
  public getFunctionDeclarations(): Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }> {
    return this.getAll().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'OBJECT',
        properties: tool.parameters.properties,
        required: tool.parameters.required || [],
      },
    }));
  }

  /**
   * Validates tool input against parameter requirements.
   */
  public validateArgs(
    tool: ToolDefinition,
    args: Record<string, unknown>
  ): { valid: boolean; error?: string } {
    if (!args || typeof args !== 'object') {
      return { valid: false, error: 'Arguments must be an object' };
    }
    const required = tool.parameters.required || [];
    for (const key of required) {
      if (args[key] === undefined || args[key] === null || args[key] === '') {
        return {
          valid: false,
          error: `Missing required argument "${key}" for tool "${tool.name}"`,
        };
      }
    }
    return { valid: true };
  }

  /**
   * Safely executes a requested tool.
   */
  public async execute(
    name: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        error: `Unknown tool "${name}". Available tools: ${Array.from(this.tools.keys()).join(', ')}`,
      };
    }

    const validation = this.validateArgs(tool, args);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
      };
    }

    try {
      return await tool.execute(args, context);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Execution error in tool "${name}": ${errorMsg}`,
      };
    }
  }
}
