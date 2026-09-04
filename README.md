# Cloudflare Autonomous Agent

A Cloudflare-native autonomous AI agent powered by Google Gemini, controlled via Telegram, and deployed on Cloudflare Workers with persistent memory and state management across Cloudflare D1, KV, and R2.

---

## Features & Capabilities

- **Cloudflare Worker Runtime**: Serverless architecture running on Cloudflare Workers (`src/index.ts`) with zero cold-start penalty, binding directly to Cloudflare primitives.
- **Gemini 3 Autonomous Reasoning Engine**:
  - Multi-step iterative tool execution loop (`src/agent/loop.ts`).
  - Full preservation of Gemini 3 `thought_signature` and thought parts across sequential function call turns, preventing HTTP 400 rejection.
  - Safe error recovery and iteration bounding to prevent runaway execution.
- **Telegram Bot Integration**:
  - Secure webhook endpoint (`/webhook/telegram`) with `X-Telegram-Bot-Api-Secret-Token` validation.
  - Distributed idempotency checks via Cloudflare KV to prevent duplicate message handling.
  - Granular sender authorization (`TELEGRAM_ALLOWED_USER_ID`) and automatic typing indicators.
  - Markdown message formatting with chunking for Telegram's 4096-character limit.
- **Cloudflare Infrastructure Management Tools**:
  - Account inspection: verify token, list accounts.
  - Worker management: list workers, inspect scripts & deployments, view bindings, fetch schedules, and monitor Worker tail logs.
- **Multi-Tier Persistence Architecture**:
  - **Cloudflare D1 (SQL)**: Relational schema for long-term memory records, conversation logs, and structured audit trails.
  - **Cloudflare KV**: Ephemeral cache for session tokens, Telegram update idempotency locks, and hot context.
  - **Cloudflare R2**: Object storage for session snapshots, logs, and artifacts.
- **Security & Secret Redaction**:
  - Automatic scrubbing of API keys, bearer tokens, and credentials from tool outputs and agent reasoning logs before transmission (`src/security/secrets.ts`).
- **Interactive UI & Test Simulator**:
  - React/Tailwind management dashboard with interactive message simulator, environment health checks, and deployment guide.
- **Comprehensive Test Suite**:
  - 38 automated Vitest unit and regression tests covering the Gemini agent loop, thought signatures, Telegram webhooks, Cloudflare API clients, storage drivers, and security policies.

---

## Project Structure

```
.
├── db/
│   └── migrations/
│       └── 0001_initial_schema.sql       # D1 relational database schema
├── src/
│   ├── agent/                           # Agent loop, context, and system prompt
│   ├── cloudflare/                      # Cloudflare API client & types
│   ├── components/                      # React UI dashboard & simulator
│   ├── config/                          # Environment variable validation
│   ├── gemini/                          # Gemini API client & thought signature preservation
│   ├── logging/                         # Structured JSON logger
│   ├── memory/                          # Long-term agent memory service
│   ├── security/                        # Authorization & secret redaction
│   ├── sessions/                        # Session management service
│   ├── storage/                         # D1, KV, and R2 storage drivers
│   ├── telegram/                        # Telegram webhook handler & bot client
│   ├── tools/                           # Tool registry (Cloudflare & Memory tools)
│   ├── index.ts                         # Cloudflare Worker entry point
│   ├── main.tsx                         # React UI entry point
│   └── App.tsx                          # Main dashboard component
├── tests/                               # 38 Vitest unit & regression tests
├── wrangler.jsonc                       # Cloudflare Workers configuration
├── package.json                         # Dependencies and build scripts
└── .env.example                         # Environment variables template
```

---

## Environment Variables

Configure the following secrets in `.dev.vars` (for local development) or Cloudflare Workers Secrets (`wrangler secret put <KEY>`):

| Variable | Description | Required |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Google Gemini API key | Yes |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API token from @BotFather | Yes |
| `TELEGRAM_WEBHOOK_SECRET` | Secret token to authenticate Telegram webhook calls | Yes |
| `TELEGRAM_ALLOWED_USER_ID` | Restrict bot access to specific Telegram user ID | No |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token for account & worker management | Yes |
| `CLOUDFLARE_ACCOUNT_ID` | Target Cloudflare Account ID | Yes |
| `GEMINI_MODEL` | Gemini model alias (default: `gemini-2.5-flash`) | No |

---

## Verification & Testing

Run all unit tests, type checking, and linting:

```bash
# Run Vitest test suite (includes Gemini 3 thought_signature regression suite)
npm test

# Run TypeScript compilation check
npm run typecheck

# Run linter
npm run lint

# Build web dashboard & compile worker assets
npm run build
```

---

## Deployment to Cloudflare Workers

1. **Deploy D1 Database Migrations**:
   ```bash
   wrangler d1 migrations apply autonomous-agent-db --remote
   ```

2. **Configure Secrets**:
   ```bash
   wrangler secret put GEMINI_API_KEY
   wrangler secret put TELEGRAM_BOT_TOKEN
   wrangler secret put TELEGRAM_WEBHOOK_SECRET
   wrangler secret put CLOUDFLARE_API_TOKEN
   ```

3. **Deploy the Worker**:
   ```bash
   wrangler deploy
   ```

4. **Register Telegram Webhook**:
   ```bash
   curl -F "url=https://<your-worker>.<subdomain>.workers.dev/webhook/telegram" \
        -F "secret_token=<YOUR_TELEGRAM_WEBHOOK_SECRET>" \
        https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_TOKEN>/setWebhook
   ```
