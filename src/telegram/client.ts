import { SecretRedactor } from '../security/secrets.js';
import { TelegramWebhookInfo } from './types.js';

export class TelegramApiError extends Error {
  public status: number;
  constructor(message: string, status: number = 500) {
    super(message);
    this.name = 'TelegramApiError';
    this.status = status;
  }
}

export class TelegramClient {
  private token: string;
  private redactor: SecretRedactor;
  private baseUrl: string;

  constructor(token: string, redactor?: SecretRedactor) {
    this.token = token.trim();
    this.redactor = redactor || new SecretRedactor([this.token]);
    this.redactor.addSecret(this.token);
    this.baseUrl = `https://api.telegram.org/bot${this.token}`;
  }

  private async request<T>(
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseUrl}/${endpoint}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = (await response.json()) as {
        ok: boolean;
        result: T;
        description?: string;
        error_code?: number;
      };

      if (!response.ok || !data.ok) {
        const desc = data.description
          ? this.redactor.redact(data.description)
          : `HTTP ${response.status}`;
        throw new TelegramApiError(
          `Telegram API error: ${desc}`,
          data.error_code || response.status
        );
      }
      return data.result;
    } catch (err) {
      if (err instanceof TelegramApiError) throw err;
      const raw = err instanceof Error ? err.message : String(err);
      throw new TelegramApiError(
        `Telegram request failed: ${this.redactor.redact(raw)}`,
        500
      );
    }
  }

  /**
   * Sends text message, automatically chunking messages longer than 4000 chars.
   */
  public async sendMessage(
    chatId: number | string,
    text: string,
    parseMode?: 'Markdown' | 'HTML'
  ): Promise<void> {
    const safeText = this.redactor.redact(text);
    const CHUNK_LIMIT = 4000;
    if (safeText.length <= CHUNK_LIMIT) {
      await this.request('sendMessage', {
        chat_id: chatId,
        text: safeText,
        parse_mode: parseMode,
      });
      return;
    }

    // Split into smaller chunks
    for (let i = 0; i < safeText.length; i += CHUNK_LIMIT) {
      const chunk = safeText.slice(i, i + CHUNK_LIMIT);
      await this.request('sendMessage', {
        chat_id: chatId,
        text: chunk,
      });
    }
  }

  /**
   * Sends chat action (e.g. typing).
   */
  public async sendChatAction(
    chatId: number | string,
    action: string = 'typing'
  ): Promise<void> {
    try {
      await this.request('sendChatAction', {
        chat_id: chatId,
        action,
      });
    } catch (err) {
      // Non-critical, ignore chat action error
      console.warn('Failed to send chat action:', err);
    }
  }

  /**
   * Sets the webhook URL for the bot.
   */
  public async setWebhook(
    url: string,
    secretToken: string
  ): Promise<boolean> {
    const result = await this.request<boolean>('setWebhook', {
      url,
      secret_token: secretToken,
      allowed_updates: ['message', 'edited_message'],
    });
    return result;
  }

  /**
   * Retrieves current webhook info.
   */
  public async getWebhookInfo(): Promise<TelegramWebhookInfo> {
    return await this.request<TelegramWebhookInfo>('getWebhookInfo');
  }

  /**
   * Connectivity check for health endpoint.
   */
  public async checkHealth(): Promise<boolean> {
    try {
      await this.getWebhookInfo();
      return true;
    } catch (err) {
      console.error('Telegram health check error:', err);
      return false;
    }
  }
}
