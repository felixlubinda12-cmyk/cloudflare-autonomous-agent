import React from 'react';
import {
  Database,
  Layers,
  Archive,
  Bot,
  MessageSquare,
  Wrench,
  CheckCircle2,
  Lock,
  Workflow,
  GitBranch,
  ShieldCheck,
} from 'lucide-react';

export const StatusOverview: React.FC = () => {
  const components = [
    {
      name: 'Cloudflare Worker',
      binding: 'Entry point (src/index.ts)',
      icon: Layers,
      color: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800',
      role: 'Autonomous Agent Runtime',
      status: 'Ready',
      detail: 'Standard ES module runtime handling HTTP requests, webhook verification, and tool orchestration.',
    },
    {
      name: 'Cloudflare D1',
      binding: 'AGENT_DB',
      icon: Database,
      color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
      role: 'Relational & Audit State',
      status: 'Connected',
      detail: 'Stores sessions, message history, agent_runs execution log, tool_calls audit log, and long-term memory.',
    },
    {
      name: 'Cloudflare KV',
      binding: 'AGENT_KV',
      icon: Archive,
      color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
      role: 'Fast Key-Value & Idempotency',
      status: 'Connected',
      detail: 'Atomic update_id deduplication (24h TTL), session cache, and transient runtime coordination.',
    },
    {
      name: 'Cloudflare R2',
      binding: 'AGENT_STORAGE',
      icon: Archive,
      color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
      role: 'Object & Artifact Storage',
      status: 'Connected',
      detail: 'Stores generated Worker scripts, deployment bundles, and large inspection artifacts.',
    },
    {
      name: 'Gemini Brain + Fallback',
      binding: 'GEMINI_API_KEY + FALLBACK',
      icon: Bot,
      color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800',
      role: 'Autonomous Reasoning Engine',
      status: 'Configured',
      detail: 'Default model: gemini-3.8-flash. Multi-step function calling loop with automatic fallback key rotation on 429/503.',
    },
    {
      name: 'GitHub Playground',
      binding: 'GITHUB_TOKEN / REPO',
      icon: GitBranch,
      color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800',
      role: 'External Code Sandbox',
      status: 'Active',
      detail: 'Isolated sandbox repository for code commits, branches, PR reviews, and GitHub Actions workflow dispatches.',
    },
    {
      name: 'Telegram Interface',
      binding: 'TELEGRAM_BOT_TOKEN',
      icon: MessageSquare,
      color: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800',
      role: 'Single-Owner Control Channel',
      status: 'Configured',
      detail: 'Webhook endpoint (/webhooks/telegram) with secret validation and single-owner authorization check.',
    },
  ];

  const tools = [
    { name: 'cloudflare_list_workers', desc: 'Lists all Workers in playground account', destructive: false },
    { name: 'cloudflare_get_worker', desc: 'Inspects Worker metadata and configuration', destructive: false },
    { name: 'cloudflare_get_worker_code', desc: 'Retrieves JavaScript source of a Worker', destructive: false },
    { name: 'cloudflare_create_worker', desc: 'Deploys a new Worker script via multipart API', destructive: false },
    { name: 'cloudflare_update_worker', desc: 'Updates an existing Worker script and settings', destructive: false },
    { name: 'cloudflare_delete_worker', desc: 'Permanently deletes a Worker script', destructive: true },
    { name: 'cloudflare_get_worker_deployments', desc: 'Fetches deployment history for a script', destructive: false },
    { name: 'cloudflare_get_subdomain', desc: 'Inspects workers.dev subdomain for account', destructive: false },
    { name: 'github_get_repository', desc: 'Inspects playground repository metadata and branches', destructive: false },
    { name: 'github_list_contents', desc: 'Lists files and directories in playground repo', destructive: false },
    { name: 'github_get_file', desc: 'Reads and decodes file content safely with size limits', destructive: false },
    { name: 'github_create_or_update_file', desc: 'Commits a file creation or update to playground repo', destructive: false },
    { name: 'github_delete_file', desc: 'Deletes a file with a dedicated git commit', destructive: true },
    { name: 'github_search_code', desc: 'Searches code strictly scoped to playground repository', destructive: false },
    { name: 'github_list_commits', desc: 'Fetches recent commit history and messages', destructive: false },
    { name: 'github_get_commit', desc: 'Inspects commit diff, patch, and file stats', destructive: false },
    { name: 'github_list_branches', desc: 'Lists existing branches in playground repo', destructive: false },
    { name: 'github_create_branch', desc: 'Creates a new branch from default or specified ref', destructive: false },
    { name: 'github_create_pull_request', desc: 'Opens a pull request between branches', destructive: false },
    { name: 'github_get_pull_request', desc: 'Inspects pull request diff and review status', destructive: false },
    { name: 'github_list_pull_requests', desc: 'Lists open or closed pull requests', destructive: false },
    { name: 'github_list_workflows', desc: 'Lists GitHub Actions workflows in playground repo', destructive: false },
    { name: 'github_trigger_workflow', desc: 'Dispatches a GitHub Actions workflow manually', destructive: false },
    { name: 'github_list_workflow_runs', desc: 'Lists recent CI workflow execution runs', destructive: false },
    { name: 'github_get_workflow_run_logs', desc: 'Analyzes failed CI runs and identifies error steps', destructive: false },
    { name: 'memory_save', desc: 'Persists user preference, key fact, or decision', destructive: false },
    { name: 'memory_search', desc: 'Searches persistent long-term memories', destructive: false },
    { name: 'memory_list', desc: 'Lists stored persistent memories by category', destructive: false },
    { name: 'memory_delete', desc: 'Deletes an outdated memory record by key', destructive: true },
  ];

  return (
    <div className="space-y-8">
      {/* Playground Account Notice */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Cloudflare Playground Environment Bound
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Account ID:{' '}
              <code className="px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200">
                7acc438ecf125d6eac5e140bcfb70d4f
              </code>
            </p>
          </div>
          <div className="flex items-center space-x-3 text-xs">
            <span className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              <span>Single-Owner Authorization Active</span>
            </span>
            <span className="flex items-center space-x-1.5 text-slate-600 dark:text-slate-400">
              <span>Max 8 Iterations / Turn</span>
            </span>
          </div>
        </div>
      </div>

      {/* Component Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {components.map((comp) => {
          const Icon = comp.icon;
          return (
            <div
              key={comp.name}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className={`p-2 rounded-lg border ${comp.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  {comp.status}
                </span>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {comp.name}
              </h3>
              <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                {comp.binding}
              </p>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                {comp.detail}
              </p>
            </div>
          );
        })}
      </div>

      {/* Execution Flow Architecture */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <div className="flex items-center space-x-2 mb-4">
          <Workflow className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Phase 1 Autonomous Request Lifecycle
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
            <span className="text-xs font-bold text-orange-600 dark:text-orange-400">Step 1</span>
            <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">
              Webhook Ingress
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Validates header secret with timing-safe comparison. Rejects 401 if invalid.
            </p>
          </div>
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Step 2</span>
            <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">
              KV Idempotency & Auth
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Deduplicates update_id. Checks sender against TELEGRAM_OWNER_ID.
            </p>
          </div>
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Step 3</span>
            <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">
              D1 Context Assembly
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Retrieves active conversation session, recent history, and persistent memories.
            </p>
          </div>
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400">Step 4</span>
            <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">
              Gemini Tool Loop
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Multi-step reasoning with Cloudflare & Memory tool calls. Audited to D1.
            </p>
          </div>
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
            <span className="text-xs font-bold text-sky-600 dark:text-sky-400">Step 5</span>
            <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">
              Telegram Dispatch
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Redacts sensitive tokens, chunks messages &gt; 4000 chars, logs to D1.
            </p>
          </div>
        </div>
      </div>

      {/* Tool Registry List */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <div className="flex items-center space-x-2 mb-4">
          <Wrench className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Registered Autonomous Tools ({tools.length})
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {tools.map((tool) => (
            <div
              key={tool.name}
              className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <code className="text-xs font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {tool.name}
                  </code>
                  {tool.destructive && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 font-medium">
                      Destructive
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {tool.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
