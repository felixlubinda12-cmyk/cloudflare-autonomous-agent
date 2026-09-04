import { describe, it, expect } from 'vitest';
import { SecretRedactor } from '../src/security/secrets.js';
import {
  timingSafeEqual,
  validateTelegramWebhookSecret,
  isAuthorizedTelegramOwner,
} from '../src/security/auth.js';

describe('Security & Redaction', () => {
  it('redacts explicit secret values from text', () => {
    const redactor = new SecretRedactor(['my-super-secret-key-12345']);
    const output = redactor.redact('Error happened with key: my-super-secret-key-12345 in call');
    expect(output).not.toContain('my-super-secret-key-12345');
    expect(output).toContain('[REDACTED_SECRET]');
  });

  it('redacts Bearer tokens and Bot tokens automatically', () => {
    const redactor = new SecretRedactor();
    const withBearer = 'Authorization: Bearer abcdef1234567890';
    expect(redactor.redact(withBearer)).toContain('Bearer [REDACTED_TOKEN]');
    const withBot = 'Calling https://api.telegram.org/bot123456789:ABCdefGhIjkLmNoPqRsTuVwXyZ1234567/getMe';
    expect(redactor.redact(withBot)).toContain('bot[REDACTED_BOT_TOKEN]');
  });

  it('sanitizes objects recursively, redacting sensitive keys', () => {
    const redactor = new SecretRedactor(['secret-token-val']);
    const obj = {
      user: 'alice',
      token: 'secret-token-val',
      config: {
        apiKey: 'xyz-key-123',
        normal: 'ok',
      },
    };
    const sanitized = redactor.sanitize(obj) as any;
    expect(sanitized.token).toBe('[REDACTED]');
    expect(sanitized.config.apiKey).toBe('[REDACTED]');
    expect(sanitized.user).toBe('alice');
    expect(sanitized.config.normal).toBe('ok');
  });

  it('validates timingSafeEqual correctly', () => {
    expect(timingSafeEqual('abcdef', 'abcdef')).toBe(true);
    expect(timingSafeEqual('abcdef', 'abcdeg')).toBe(false);
    expect(timingSafeEqual('abcdef', 'abc')).toBe(false);
  });

  it('validates Telegram webhook secret token safely', () => {
    expect(validateTelegramWebhookSecret('my-secret-123', 'my-secret-123')).toBe(true);
    expect(validateTelegramWebhookSecret('wrong-secret', 'my-secret-123')).toBe(false);
    expect(validateTelegramWebhookSecret(null, 'my-secret-123')).toBe(false);
  });

  it('enforces single-owner Telegram authorization', () => {
    expect(isAuthorizedTelegramOwner('12345', '12345')).toBe(true);
    expect(isAuthorizedTelegramOwner(12345, '12345')).toBe(true);
    expect(isAuthorizedTelegramOwner('99999', '12345')).toBe(false);
    expect(isAuthorizedTelegramOwner('12345', undefined)).toBe(false);
  });
});
