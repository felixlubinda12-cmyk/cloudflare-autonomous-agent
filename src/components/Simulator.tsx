import React, { useState } from 'react';
import { Send, Terminal, Sparkles, RefreshCw, CheckCircle2 } from 'lucide-react';

interface SimulatedMessage {
  id: string;
  sender: 'user' | 'agent' | 'system';
  text: string;
  toolCalls?: Array<{ tool: string; args: string; result: string }>;
  iterations?: number;
  timestamp: string;
}

export const Simulator: React.FC = () => {
  const [messages, setMessages] = useState<SimulatedMessage[]>([
    {
      id: '1',
      sender: 'agent',
      text: `  Welcome to Cloudflare Autonomous Agent (Phase 1) Interactive Console!\n\nI am connected to the Cloudflare playground account (7acc438ecf125d6eac5e140bcfb70d4f).\nTry sending deterministic commands like /status or natural language instructions like "List my workers".`,
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const samplePrompts = [
    '/status',
    '/help',
    'List my workers',
    'What is my workers.dev subdomain?',
    'Create a worker called health-api that returns JSON { "status": "ok" }',
    'Remember that my team uses Hono for Cloudflare Workers',
    'What memories do you have saved?',
  ];

  const handleSend = async (userText?: string) => {
    const text = (userText || input).trim();
    if (!text || isProcessing) return;

    const userMsg: SimulatedMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsProcessing(true);

    // Simulate processing delay for realism
    await new Promise((resolve) => setTimeout(resolve, 600));

    const lower = text.toLowerCase();
    let agentResponse = '';
    let toolCalls: Array<{ tool: string; args: string; result: string }> | undefined;
    let iterations = 1;

    if (lower === '/start') {
      agentResponse = `  Cloudflare Autonomous Agent (Phase 1)\n\nI am your persistent AI agent running on Cloudflare Workers, with memory in D1, fast state in KV, artifact storage in R2, and reasoning by Gemini.\n\nType /help for command syntax.`;
    } else if (lower === '/help') {
      agentResponse = `  Available Commands:\n  /start - Welcome message\n  /help - Usage guide\n  /status - Binding & session diagnostics\n  /new - Start fresh conversation session\n  /reset - Clear active conversation context\n\nNatural language requests:\n  "List my workers"\n  "Show details for worker <name>"\n  "Create worker <name>"\n  "Delete worker <name>"\n  "Remember that <fact>"`;
    } else if (lower === '/status') {
      agentResponse = `  Agent Status (Phase 1)\n\n  Runtime: Cloudflare Worker\n  Reasoning Engine: gemini-3.8-flash\n  Max Iterations: 8\n  Account ID: 7acc43...d4f\n  Session ID: active-session-001\n  Bindings:\n  - KV (AGENT_KV): Connected\n  - D1 (AGENT_DB): Connected\n  - R2 (AGENT_STORAGE): Connected`;
    } else if (lower === '/new' || lower === '/reset') {
      agentResponse = `  Conversation session context reset. Long-term memory records are preserved.`;
    } else if (lower.includes('list') && lower.includes('worker')) {
      iterations = 2;
      toolCalls = [
        {
          tool: 'cloudflare_list_workers',
          args: '{}',
          result: JSON.stringify(
            [
              { id: 'auth-worker', created_on: '2026-09-01T10:00:00Z', modified_on: '2026-09-02T14:22:00Z' },
              { id: 'playground-test', created_on: '2026-09-03T08:15:00Z', modified_on: '2026-09-03T08:15:00Z' },
            ],
            null,
            2
          ),
        },
      ];
      agentResponse = `Found 2 workers in your Cloudflare playground account:\n\n1. **auth-worker** (modified: 2026-09-02)\n2. **playground-test** (modified: 2026-09-03)\n\nWould you like me to inspect the code or configuration of any of these workers?`;
    } else if (lower.includes('subdomain')) {
      iterations = 2;
      toolCalls = [
        {
          tool: 'cloudflare_get_subdomain',
          args: '{}',
          result: JSON.stringify({ subdomain: 'autonomous-agent' }, null, 2),
        },
      ];
      agentResponse = `Your dedicated account's workers.dev subdomain is:\n\`autonomous-agent.workers.dev\``;
    } else if (lower.includes('remember')) {
      iterations = 2;
      toolCalls = [
        {
          tool: 'memory_save',
          args: JSON.stringify({ key: 'framework_pref', content: text, category: 'preference' }),
          result: JSON.stringify({ success: true, message: 'Memory saved successfully' }),
        },
      ];
      agentResponse = `I have recorded that in long-term memory:\n  **Category:** Preference\n  **Content:** "${text.replace(/remember that/i, '').trim()}"`;
    } else if (lower.includes('memories') || lower.includes('memory')) {
      iterations = 2;
      toolCalls = [
        {
          tool: 'memory_list',
          args: '{}',
          result: JSON.stringify(
            [
              { category: 'preference', key: 'framework_pref', content: 'Uses Hono for Workers' },
              { category: 'config', key: 'default_compat_date', content: '2024-09-23' },
            ],
            null,
            2
          ),
        },
      ];
      agentResponse = `Here are the active long-term memories stored in D1:\n\n1. [preference] \`framework_pref\`: Uses Hono for Workers\n2. [config] \`default_compat_date\`: 2024-09-23`;
    } else if (lower.includes('create') && lower.includes('worker')) {
      iterations = 2;
      toolCalls = [
        {
          tool: 'cloudflare_create_worker',
          args: JSON.stringify(
            {
              script_name: 'health-api',
              content: 'export default { async fetch() { return new Response(JSON.stringify({ status: "ok" })); } }',
            },
            null,
            2
          ),
          result: JSON.stringify({ success: true, id: 'health-api', usage_model: 'standard' }),
        },
      ];
      agentResponse = `The Worker **health-api** has been deployed to Cloudflare playground account (7acc43...d4f)!\n\n  **Script Name:** \`health-api\`\n  **Entry Point:** ES Module (fetch)\n  **Verification:** Cloudflare API confirmed HTTP 200 upload.`;
    } else {
      agentResponse = `I received your instruction: "${text}".\n\nIn live operation via Telegram webhook, this prompt is evaluated by Gemini Flash against the 12 registered Cloudflare and memory tools to query or modify your account.`;
    }

    const agentMsg: SimulatedMessage = {
      id: crypto.randomUUID(),
      sender: 'agent',
      text: agentResponse,
      toolCalls,
      iterations,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, agentMsg]);
    setIsProcessing(false);
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden flex flex-col h-[650px]">
      {/* Console Top Bar */}
      <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Agent Reasoning & Tool Simulator
          </span>
        </div>
        <button
          onClick={() =>
            setMessages([
              {
                id: '1',
                sender: 'agent',
                text: 'Session reset. Ready for your prompt.',
                timestamp: new Date().toLocaleTimeString(),
              },
            ])
          }
          className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center space-x-1"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Clear Screen</span>
        </button>
      </div>

      {/* Suggested Prompts */}
      <div className="px-4 py-2 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 flex items-center space-x-2 overflow-x-auto text-xs whitespace-nowrap">
        <span className="text-slate-400 font-medium flex items-center">
          <Sparkles className="w-3 h-3 mr-1 text-orange-500" /> Prompts:
        </span>
        {samplePrompts.map((p) => (
          <button
            key={p}
            onClick={() => handleSend(p)}
            className="px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Message Stream */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-2xl rounded-xl px-4 py-3 text-sm ${
                msg.sender === 'user'
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
              }`}
            >
              <div className="whitespace-pre-wrap font-sans leading-relaxed">
                {msg.text}
              </div>

              {/* Display Tool Calls if any */}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>
                      Autonomous Tool Execution ({msg.iterations} iterations)
                    </span>
                  </div>
                  {msg.toolCalls.map((tc, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded bg-black/5 dark:bg-black/30 text-xs font-mono"
                    >
                      <div className="text-orange-600 dark:text-orange-400 font-semibold">
                        &gt; {tc.tool}
                      </div>
                      <div className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5 truncate">
                        args: {tc.args}
                      </div>
                      <div className="text-emerald-700 dark:text-emerald-400 text-[11px] mt-0.5 max-h-20 overflow-y-auto">
                        result: {tc.result}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 px-1">
              {msg.timestamp}
            </span>
          </div>
        ))}

        {isProcessing && (
          <div className="flex items-center space-x-2 text-xs text-slate-400 p-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-orange-500" />
            <span>Agent reasoning and inspecting tools...</span>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center space-x-2"
        >
          <input
            id="simulator-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a command (/status, /help) or natural language instruction..."
            className="flex-1 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            id="simulator-send"
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center space-x-1.5"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
