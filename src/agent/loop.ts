import { GeminiService } from '../gemini/client.js';
import { GeminiContent, GeminiPart } from '../gemini/types.js';
import { ToolRegistry } from '../tools/registry.js';
import { ToolExecutionContext } from '../tools/types.js';
import { D1Service } from '../storage/d1.js';
import { Logger } from '../logging/logger.js';

export interface AgentRunResult {
  runId: string;
  response: string;
  iterations: number;
  status: 'completed' | 'max_iterations' | 'failed';
  error?: string;
}

export class AgentLoop {
  private gemini: GeminiService;
  private tools: ToolRegistry;
  private d1: D1Service;
  private maxIterations: number;
  private logger: Logger;

  constructor(
    gemini: GeminiService,
    tools: ToolRegistry,
    d1: D1Service,
    maxIterations: number = 8,
    logger?: Logger
  ) {
    this.gemini = gemini;
    this.tools = tools;
    this.d1 = d1;
    this.maxIterations = maxIterations;
    this.logger = logger || new Logger();
  }

  /**
   * Executes the multi-step agent reasoning & tool loop.
   */
  public async run(
    sessionId: string,
    userRequest: string,
    systemInstruction: string,
    initialContents: GeminiContent[],
    toolContext: ToolExecutionContext
  ): Promise<AgentRunResult> {
    const runId = crypto.randomUUID();
    const now = Date.now();
    toolContext.runId = runId;

    // 1. Audit log: Record agent_runs start
    await this.d1.db
      .prepare(
        `INSERT INTO agent_runs (id, session_id, user_request, status, iterations, created_at)
         VALUES (?, ?, ?, 'running', 0, ?)`
      )
      .bind(runId, sessionId, userRequest, now)
      .run();

    const functionDeclarations = this.tools.getFunctionDeclarations();
    const contents: GeminiContent[] = [...initialContents];

    let iteration = 0;
    let finalAnswer = '';

    while (iteration < this.maxIterations) {
      iteration++;
      this.logger.debug(`Starting agent iteration ${iteration}/${this.maxIterations}`, {
        sessionId,
        runId,
        iteration,
      });

      let geminiRes;
      try {
        geminiRes = await this.gemini.generateContent({
          systemInstruction,
          contents,
          tools: functionDeclarations,
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        this.logger.error('Gemini error during agent loop', err, { runId, sessionId });
        await this.d1.db
          .prepare(
            `UPDATE agent_runs
             SET status = 'failed', error = ?, iterations = ?, completed_at = ?
             WHERE id = ?`
          )
          .bind(errorMsg, iteration, Date.now(), runId)
          .run();

        return {
          runId,
          response: `I encountered an issue connecting to the reasoning engine: ${errorMsg}`,
          iterations: iteration,
          status: 'failed',
          error: errorMsg,
        };
      }

      // Check if tool calls were requested
      if (geminiRes.toolCalls && geminiRes.toolCalls.length > 0) {
        // Append the model's tool call turn to contents, preserving complete parts and thought signatures
        let modelParts: GeminiPart[];
        if (geminiRes.candidateParts && geminiRes.candidateParts.length > 0) {
          modelParts = geminiRes.candidateParts;
        } else {
          modelParts = geminiRes.toolCalls.map((tc) => {
            if (tc.part) {
              return tc.part;
            }
            const part: GeminiPart = {
              functionCall: {
                name: tc.name,
                args: tc.args,
              },
            };
            if (tc.thoughtSignature) {
              part.thoughtSignature = tc.thoughtSignature;
            }
            if (tc.thought_signature) {
              part.thought_signature = tc.thought_signature;
            }
            return part;
          });
          if (geminiRes.text && !modelParts.some((p) => p.text === geminiRes.text)) {
            modelParts.unshift({ text: geminiRes.text });
          }
        }

        contents.push({
          role: 'model',
          parts: modelParts,
        });

        // Execute each tool call
        const functionResponses: GeminiPart[] = [];
        for (const toolCall of geminiRes.toolCalls) {
          const callId = crypto.randomUUID();
          this.logger.info(`Executing tool: ${toolCall.name}`, {
            runId,
            sessionId,
            toolName: toolCall.name,
          });

          const toolResult = await this.tools.execute(
            toolCall.name,
            toolCall.args,
            toolContext
          );

          // Audit log in D1 tool_calls table
          await this.d1.db
            .prepare(
              `INSERT INTO tool_calls (id, run_id, session_id, tool_name, arguments, result, is_error, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              callId,
              runId,
              sessionId,
              toolCall.name,
              JSON.stringify(toolCall.args),
              JSON.stringify(toolResult.data || toolResult.error || {}),
              toolResult.success ? 0 : 1,
              Date.now()
            )
            .run();

          functionResponses.push({
            functionResponse: {
              name: toolCall.name,
              response: toolResult.success
                ? { output: toolResult.data }
                : { error: toolResult.error },
            },
          });
        }

        // Add tool results as user/function turn back into contents
        contents.push({
          role: 'user',
          parts: functionResponses,
        });

        // Continue to next iteration so the model can reason about the results
        continue;
      }

      // If no tool calls, model produced final response
      finalAnswer = geminiRes.text || 'Action completed.';
      break;
    }

    if (!finalAnswer && iteration >= this.maxIterations) {
      finalAnswer = `I reached the maximum iteration limit (${this.maxIterations} steps) for this request. Please review the progress or re-issue with a more specific instruction.`;
      await this.d1.db
        .prepare(
          `UPDATE agent_runs
           SET status = 'max_iterations', iterations = ?, completed_at = ?
           WHERE id = ?`
        )
        .bind(iteration, Date.now(), runId)
        .run();

      return {
        runId,
        response: finalAnswer,
        iterations: iteration,
        status: 'max_iterations',
      };
    }

    // Mark run as completed in D1
    await this.d1.db
      .prepare(
        `UPDATE agent_runs
         SET status = 'completed', iterations = ?, completed_at = ?
         WHERE id = ?`
      )
      .bind(iteration, Date.now(), runId)
      .run();

    return {
      runId,
      response: finalAnswer,
      iterations: iteration,
      status: 'completed',
    };
  }
}
