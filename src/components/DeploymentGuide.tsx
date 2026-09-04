import React, { useState } from 'react';
import { Copy, Check, Terminal, KeyRound, ShieldAlert } from 'lucide-react';

export const DeploymentGuide: React.FC = () => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const steps = [
    {
      title: '1. Create Cloudflare Storage Resources',
      desc: 'Create the D1 database, KV namespace, and R2 bucket in your Cloudflare account.',
      code: `# 1. Create D1 Database
npx wrangler d1 create agent-db

# 2. Apply Migration Schema (sessions, messages, agent_runs, tool_calls, memory)
npx wrangler d1 migrations apply agent-db --remote

# 3. Create KV Namespace for Idempotency
npx wrangler kv:namespace create AGENT_KV

# 4. Create R2 Bucket for Artifacts
npx wrangler r2 bucket create agent-storage`,
    },
    {
      title: '2. Configure Secret Keys & Playground Repo via Wrangler',
      desc: 'Set sensitive credentials as encrypted Cloudflare secrets and configure playground target repository.',
      code: `# Core Agent Secrets
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put CLOUDFLARE_API_TOKEN
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put TELEGRAM_OWNER_ID

# Phase 2 Gemini Fallback Key (Optional but recommended)
npx wrangler secret put GEMINI_FALLBACK_API_KEY

# Phase 2 GitHub Playground Sandbox (Fine-grained PAT scoped to 1 repository)
# Nimo automatically discovers the authorized playground repository from this token
npx wrangler secret put GITHUB_TOKEN`,
    },
    {
      title: '3. Deploy the Autonomous Agent Worker',
      desc: 'Deploy the Worker code to your Cloudflare playground account.',
      code: `npx wrangler deploy`,
    },
    {
      title: '4. Register Telegram Webhook',
      desc: 'Configure Telegram to deliver webhook updates to your Worker with the secret token.',
      code: `curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://<YOUR_WORKER_SUBDOMAIN>.workers.dev/webhooks/telegram",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>",
    "allowed_updates": ["message", "edited_message"]
  }'`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-5">
        <div className="flex items-start space-x-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="text-sm">
            <h4 className="font-semibold text-amber-900 dark:text-amber-200">
              Phase 1 Production Security Protocol
            </h4>
            <p className="mt-1 text-amber-800/80 dark:text-amber-300/80 text-xs leading-relaxed">
              Ensure <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded">TELEGRAM_OWNER_ID</code> is set to your personal Telegram User ID (obtainable via @userinfobot). This guarantees that nobody else can invoke tools or execute commands against your dedicated Cloudflare playground account.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {steps.map((step, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {step.title}
                </h3>
              </div>
              <button
                onClick={() => copyToClipboard(step.code, idx)}
                className="text-xs px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center space-x-1 transition"
              >
                {copiedIndex === idx ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              {step.desc}
            </p>
            <pre className="p-3.5 rounded-lg bg-slate-950 text-slate-100 text-xs font-mono overflow-x-auto border border-slate-800 leading-relaxed">
              {step.code}
            </pre>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="flex items-center space-x-2 mb-2">
          <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Environment & Secrets Reference
          </h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          All configuration variables are defined in <code className="font-mono text-slate-800 dark:text-slate-200">.env.example</code> and validated on startup with typed diagnostics.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
          <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
            <span className="text-orange-600 dark:text-orange-400">GEMINI_API_KEY</span>
            <span className="text-slate-500 block text-[11px] font-sans">Google AI Studio API Key</span>
          </div>
          <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
            <span className="text-orange-600 dark:text-orange-400">CLOUDFLARE_API_TOKEN</span>
            <span className="text-slate-500 block text-[11px] font-sans">Scoped Workers:Edit token</span>
          </div>
          <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
            <span className="text-orange-600 dark:text-orange-400">TELEGRAM_BOT_TOKEN</span>
            <span className="text-slate-500 block text-[11px] font-sans">From Telegram @BotFather</span>
          </div>
          <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
            <span className="text-orange-600 dark:text-orange-400">TELEGRAM_WEBHOOK_SECRET</span>
            <span className="text-slate-500 block text-[11px] font-sans">High-entropy secret string</span>
          </div>
        </div>
      </div>
    </div>
  );
};
