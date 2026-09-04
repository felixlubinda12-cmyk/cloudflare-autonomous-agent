import { Env } from '../types/env.js';
import { getAppConfig } from '../config/env.js';
import { TelegramClient } from './client.js';
import { TelegramUpdate } from './types.js';
import { validateTelegramWebhookSecret, isAuthorizedTelegramOwner } from '../security/auth.js';
import { SecretRedactor } from '../security/secrets.js';
import { Logger } from '../logging/logger.js';
import { KvService } from '../storage/kv.js';
import { D1Service } from '../storage/d1.js';
import { R2Service } from '../storage/r2.js';
import { SessionService } from '../sessions/service.js';
import { MemoryService } from '../memory/service.js';
import { CloudflareService } from '../cloudflare/client.js';
import { GeminiService } from '../gemini/client.js';
import { GitHubService } from '../github/client.js';
import { AgentService } from '../agent/agent.js';

export async function handleTelegramWebhook(
  request: Request,
  env: Env
): Promise<Response> {
  const logger = new Logger(
    (env.LOG_LEVEL?.toLowerCase() as any) || 'info',
    new SecretRedactor([
      env.GEMINI_API_KEY,
      env.GEMINI_FALLBACK_API_KEY,
      env.CLOUDFLARE_API_TOKEN,
      env.TELEGRAM_BOT_TOKEN,
      env.TELEGRAM_WEBHOOK_SECRET,
      env.GITHUB_TOKEN,
    ])
  );

  let config;
  try {
    config = getAppConfig(env);
  } catch (err) {
    logger.error('Configuration error in Telegram webhook handler', err);
    return new Response('Configuration error', { status: 500 });
  }

  // 1. Validate Webhook Secret Header
  const secretHeader = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  const isValidSecret = validateTelegramWebhookSecret(
    secretHeader,
    config.telegramWebhookSecret
  );

  if (!isValidSecret) {
    logger.warn('Unauthorized webhook request: invalid or missing secret token');
    return new Response('Unauthorized', { status: 401 });
  }

  // 2. Parse Telegram Update
  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch (err) {
    logger.error('Failed to parse Telegram webhook body JSON', err);
    return new Response('Bad Request', { status: 400 });
  }

  const message = update.message || update.edited_message;
  if (!message || !message.text) {
    // Ignore updates without text (e.g. status updates, stickers)
    return new Response('OK', { status: 200 });
  }

  const updateId = update.update_id;
  const chatId = message.chat.id;
  const senderId = message.from ? message.from.id : chatId;
  const text = message.text.trim();

  const telegram = new TelegramClient(config.telegramBotToken);
  const kv = new KvService(env.AGENT_KV);
  const d1 = new D1Service(env.AGENT_DB);
  const r2 = new R2Service(env.AGENT_STORAGE);

  // Self-heal initial D1 schema if not yet created
  try {
    await d1.ensureSchema();
  } catch (err) {
    logger.error('Failed to bootstrap D1 schema', err);
  }

  // 3. Idempotency Check: prevent duplicate processing of the same update
  const isNewUpdate = await kv.checkAndRecordUpdateId(updateId);
  if (!isNewUpdate) {
    logger.info(`Duplicate Telegram update skipped`, { updateId });
    return new Response('OK', { status: 200 });
  }

  // 4. Owner Authorization Check
  if (config.telegramOwnerId) {
    const isOwner = isAuthorizedTelegramOwner(senderId, config.telegramOwnerId);
    if (!isOwner) {
      logger.warn(`Unauthorized access attempt from user ${senderId}`, {
        senderId,
        chatId,
      });
      await telegram.sendMessage(
        chatId,
        '  Unauthorized. This autonomous agent instance is restricted to its configured owner.'
      );
      return new Response('OK', { status: 200 });
    }
  }

  const sessions = new SessionService(d1);
  const memory = new MemoryService(d1);
  const userIdStr = String(senderId);
  const chatIdStr = String(chatId);

  // 5. Handle Deterministic Commands (do not invoke LLM)
  const lowerText = text.toLowerCase();

  if (lowerText === '/start') {
    const welcome = `  *Cloudflare Autonomous Agent (Phase 1)*

I am your persistent AI agent running on Cloudflare Workers, with memory in D1, fast state in KV, artifact storage in R2, and reasoning by Gemini.

*Available Commands:*
  /help - Detailed capabilities and example commands
  /status - View agent, session, and resource status
  /new - Start a fresh conversation session
  /reset - Clear current session context

*What you can ask me naturally:*
  "List my workers"
  "Show details for worker test-worker"
  "Create a worker called hello-api that returns Hello World"
  "Show my workers.dev subdomain"
  "Remember that my default worker compatibility date is 2024-09-23"
  "Inspect playground repository"
  "List files in playground repo"
  "Create a PR in playground repo"`;
    await telegram.sendMessage(chatId, welcome);
    return new Response('OK', { status: 200 });
  }

  if (lowerText === '/help') {
    const help = `*Cloudflare Autonomous Agent Commands & Capabilities*

*Deterministic Commands:*
  /start - Welcome & intro
  /help - This guide
  /status - Health & binding diagnostics
  /new - Start fresh conversation session
  /reset - Archive active conversation session

*Natural-Language Cloudflare Tools:*
  *List Workers:* "List my workers"
  *Inspect Worker:* "Show me worker <name>" or "Get code for worker <name>"
  *Create Worker:* "Create a worker called <name> that handles GET /api"
  *Update Worker:* "Update worker <name> with new code"
  *Delete Worker:* "Delete worker <name>" (destructive)
  *Subdomain:* "What is my account's workers.dev subdomain?"
  *Deployments:* "Show deployment history for <name>"

*GitHub Playground (Phase 2):*
  *Inspect Repo:* "Show playground repository info"
  *Files:* "Read file <path>" or "Create file <path> with content ..."
  *Search:* "Search code for <keyword>"
  *Commits & Branches:* "List commits" or "Create branch <name>"
  *Pull Requests:* "Create a PR from <head> to <base>" or "List open PRs"
  *Workflows:* "List workflows" or "Trigger workflow <name>" or "Show workflow run <id>"

*Memory System:*
  "Remember that my project name is Acme API"
  "What memories do you have stored?"
  "Forget memory <key>"`;
    await telegram.sendMessage(chatId, help);
    return new Response('OK', { status: 200 });
  }

  if (lowerText === '/status') {
    const activeSession = await sessions.getOrCreateSession(userIdStr, chatIdStr);
    const maskedAccount = config.cloudflareAccountId
      ? `${config.cloudflareAccountId.slice(0, 6)}...${config.cloudflareAccountId.slice(-4)}`
      : 'Not configured';
    let githubRepoStatus = 'Not configured';
    if (config.githubToken) {
      try {
        const gh = new GitHubService(config.githubToken);
        const resolved = await gh.resolveAuthorizedRepository();
        githubRepoStatus = resolved.fullName;
      } catch (err: any) {
        githubRepoStatus = `Configured (${err.message || String(err)})`;
      }
    }
    const fallbackStatus = config.geminiFallbackApiKey ? 'Configured' : 'None';

    const statusMsg = `*Agent Status (Phase 2)*

*Runtime:* Cloudflare Worker
*Reasoning Engine:* ${config.geminiModel}
*Fallback Key:* ${fallbackStatus}
*Max Iterations:* ${config.agentMaxIterations}
*Account ID:* ${maskedAccount}
*GitHub Playground:* \`${githubRepoStatus}\`
*Session ID:* \`${activeSession.id}\`
*Owner ID Configured:* ${config.telegramOwnerId ? 'Yes' : 'No'}

*Bindings:*
- KV (AGENT_KV): Connected
- D1 (AGENT_DB): Connected
- R2 (AGENT_STORAGE): Connected`;
    await telegram.sendMessage(chatId, statusMsg);
    return new Response('OK', { status: 200 });
  }

  if (lowerText === '/new' || lowerText === '/reset') {
    const newSession = await sessions.resetSession(userIdStr, chatIdStr);
    await telegram.sendMessage(
      chatId,
      `Session reset! Started a new conversation session (\`${newSession.id.slice(0, 8)}...\`). Stored long-term memories are preserved.`
    );
    return new Response('OK', { status: 200 });
  }

  // 6. Natural Language Request -> Agent Reasoning Loop
  await telegram.sendChatAction(chatId, 'typing');
  const activeSession = await sessions.getOrCreateSession(userIdStr, chatIdStr);
  const cloudflare = new CloudflareService(
    config.cloudflareApiToken,
    config.cloudflareAccountId
  );
  const gemini = new GeminiService(
    config.geminiApiKey,
    config.geminiModel,
    undefined,
    config.geminiFallbackApiKey
  );
  const github = new GitHubService(
    config.githubToken
  );
  const agent = new AgentService({
    sessions,
    memory,
    cloudflare,
    github,
    gemini,
    kv,
    r2,
    d1,
    accountId: config.cloudflareAccountId,
    maxIterations: config.agentMaxIterations,
    logger,
  });

  try {
    const responseText = await agent.handleUserMessage(activeSession, text);
    await telegram.sendMessage(chatId, responseText);
  } catch (err) {
    logger.error('Unhandled error in agent execution', err, { chatId, updateId });
    const userSafeError = 'I encountered an unexpected error while processing your request. Please try again or rephrase.';
    await telegram.sendMessage(chatId, userSafeError);
  }

  return new Response('OK', { status: 200 });
}
