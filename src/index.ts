/**
 * Cloudflare Autonomous Agent - Phase 1 Entry Point
 * Running on Cloudflare Workers
 */
import { Env } from './types/env.js';
import { handleTelegramWebhook } from './telegram/webhook.js';
import { TelegramClient } from './telegram/client.js';
import { D1Service } from './storage/d1.js';
import { R2Service } from './storage/r2.js';
import { validateTelegramWebhookSecret, validateAdminSecret } from './security/auth.js';

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS headers for potential preflight/testing
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Telegram-Bot-Api-Secret-Token, X-Admin-Secret',
        },
      });
    }

    // 1. Root Information Endpoint
    if (path === '/' && method === 'GET') {
      const info = {
        name: 'Cloudflare Autonomous Agent',
        phase: 'Phase 1',
        description: 'Autonomous AI agent powered by Gemini, running on Cloudflare Workers, controlled via Telegram.',
        status: 'operational',
        endpoints: {
          health: 'GET /health',
          webhook: 'POST /webhooks/telegram',
          setup: 'POST /webhooks/telegram/setup',
        },
      };
      return new Response(JSON.stringify(info, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Health Check Endpoint
    if (path === '/health' && method === 'GET') {
      const services: Record<string, string> = {};
      let isHealthy = true;

      // Check D1
      if (env.AGENT_DB) {
        try {
          const d1 = new D1Service(env.AGENT_DB);
          const d1Ok = await d1.checkHealth();
          services.d1 = d1Ok ? 'healthy' : 'unhealthy';
          if (!d1Ok) isHealthy = false;
        } catch {
          services.d1 = 'error';
          isHealthy = false;
        }
      } else {
        services.d1 = 'missing_binding';
        isHealthy = false;
      }

      // Check KV
      if (env.AGENT_KV) {
        try {
          await env.AGENT_KV.get('health_probe');
          services.kv = 'healthy';
        } catch {
          services.kv = 'error';
          isHealthy = false;
        }
      } else {
        services.kv = 'missing_binding';
        isHealthy = false;
      }

      // Check R2
      if (env.AGENT_STORAGE) {
        try {
          const r2 = new R2Service(env.AGENT_STORAGE);
          const r2Ok = await r2.checkHealth();
          services.r2 = r2Ok ? 'healthy' : 'unhealthy';
        } catch {
          services.r2 = 'error';
        }
      } else {
        services.r2 = 'missing_binding';
      }

      // Check Secrets Configuration (existence without exposing values)
      services.gemini = env.GEMINI_API_KEY ? 'configured' : 'missing';
      services.gemini_fallback = env.GEMINI_FALLBACK_API_KEY ? 'configured' : 'optional_not_set';
      services.github_playground = env.GITHUB_TOKEN ? 'configured' : 'optional_not_set';
      services.cloudflare = env.CLOUDFLARE_API_TOKEN ? 'configured' : 'missing';
      services.telegram = env.TELEGRAM_BOT_TOKEN ? 'configured' : 'missing';
      services.webhook_secret = env.TELEGRAM_WEBHOOK_SECRET ? 'configured' : 'missing';

      if (
        services.gemini !== 'configured' ||
        services.cloudflare !== 'configured' ||
        services.telegram !== 'configured' ||
        services.webhook_secret !== 'configured'
      ) {
        isHealthy = false;
      }

      const healthPayload = {
        status: isHealthy ? 'healthy' : 'degraded',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        services,
      };

      return new Response(JSON.stringify(healthPayload, null, 2), {
        status: isHealthy ? 200 : 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Telegram Webhook Endpoint
    if (path === '/webhooks/telegram' && method === 'POST') {
      return await handleTelegramWebhook(request, env);
    }

    // 4. Authenticated Webhook Setup Endpoint
    if (path === '/webhooks/telegram/setup' && method === 'POST') {
      // Authenticate with either Telegram webhook secret or Admin secret
      const secretHeader = request.headers.get('X-Telegram-Bot-Api-Secret-Token') ||
        request.headers.get('X-Admin-Secret') ||
        request.headers.get('Authorization');

      const isSecretValid =
        (env.TELEGRAM_WEBHOOK_SECRET && validateTelegramWebhookSecret(secretHeader, env.TELEGRAM_WEBHOOK_SECRET)) ||
        (env.ADMIN_SECRET && validateAdminSecret(secretHeader, env.ADMIN_SECRET));

      if (!isSecretValid) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      let reqBody: { url?: string } = {};
      try {
        reqBody = (await request.json()) as { url?: string };
      } catch {
        // ignore
      }

      const webhookUrl = reqBody.url || `${url.origin}/webhooks/telegram`;

      if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) {
        return new Response(
          JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET must be configured' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const telegram = new TelegramClient(env.TELEGRAM_BOT_TOKEN);
      try {
        const success = await telegram.setWebhook(webhookUrl, env.TELEGRAM_WEBHOOK_SECRET);
        return new Response(
          JSON.stringify({
            success,
            message: `Telegram webhook configured to: ${webhookUrl}`,
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({
            success: false,
            error: err instanceof Error ? err.message : String(err),
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
