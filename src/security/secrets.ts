/**
 * Secret redaction utility
 * Ensures tokens, keys, and authorization headers are never exposed in logs,
 * tool results, error messages, or Telegram outputs.
 */
const SENSITIVE_PATTERNS = [
  /Bearer\s+([A-Za-z0-9_\-.]{8,})/gi,
  /bot([0-9]{8,12}:[A-Za-z0-9_-]{30,})/gi,
  /key=([A-Za-z0-9_-]{16,})/gi,
  /(?:api[_-]?token|api[_-]?key|secret[_-]?token)\s*[:=]\s*["']?([A-Za-z0-9_\-.]{8,})["']?/gi,
  /X-Telegram-Bot-Api-Secret-Token:\s*([^\r\n]+)/gi,
  /Authorization:\s*Bearer\s+([^\r\n]+)/gi,
];

export class SecretRedactor {
  private knownSecrets: Set<string> = new Set();

  constructor(secrets: (string | undefined | null)[] = []) {
    for (const secret of secrets) {
      if (secret && typeof secret === 'string' && secret.trim().length >= 4) {
        this.knownSecrets.add(secret.trim());
      }
    }
  }

  public addSecret(secret?: string | null): void {
    if (secret && typeof secret === 'string' && secret.trim().length >= 4) {
      this.knownSecrets.add(secret.trim());
    }
  }

  /**
   * Redacts all known secrets and sensitive patterns from a string.
   */
  public redact(text: string): string {
    if (!text || typeof text !== 'string') {
      return text;
    }

    let redacted = text;

    // 1. Redact exact known secrets
    for (const secret of this.knownSecrets) {
      if (secret && secret.length > 0) {
        redacted = redacted.split(secret).join('[REDACTED_SECRET]');
      }
    }

    // 2. Redact regex patterns
    redacted = redacted.replace(/Bearer\s+([A-Za-z0-9_\-.]{8,})/gi, 'Bearer [REDACTED_TOKEN]');
    redacted = redacted.replace(/bot([0-9]{8,12}:[A-Za-z0-9_-]{30,})/gi, 'bot[REDACTED_BOT_TOKEN]');
    redacted = redacted.replace(/(api[_-]?key=)([A-Za-z0-9_-]{10,})/gi, '$1[REDACTED_KEY]');
    redacted = redacted.replace(
      /(["']?(?:api[_\-]?token|api[_\-]?key|webhook[_\-]?secret|bot[_\-]?token)["']?\s*[:=]\s*["'])([^"']{4,})(["'])/gi,
      '$1[REDACTED]$3'
    );

    return redacted;
  }

  /**
   * Safely sanitizes arbitrary objects or values, redacting nested strings.
   */
  public sanitize(val: unknown): unknown {
    if (val === null || val === undefined) {
      return val;
    }
    if (typeof val === 'string') {
      return this.redact(val);
    }
    if (typeof val === 'number' || typeof val === 'boolean') {
      return val;
    }
    if (Array.isArray(val)) {
      return val.map((item) => this.sanitize(item));
    }
    if (typeof val === 'object') {
      const sanitizedObj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        const lowerKey = k.toLowerCase();
        if (
          lowerKey.includes('token') ||
          lowerKey.includes('secret') ||
          lowerKey.includes('apikey') ||
          lowerKey.includes('api_key') ||
          lowerKey.includes('authorization') ||
          lowerKey.includes('password')
        ) {
          sanitizedObj[k] = '[REDACTED]';
        } else {
          sanitizedObj[k] = this.sanitize(v);
        }
      }
      return sanitizedObj;
    }
    return String(val);
  }
}
