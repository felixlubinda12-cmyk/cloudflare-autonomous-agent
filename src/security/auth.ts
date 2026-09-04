/**
 * Security and Authentication utilities
 * Constant-time string comparison to prevent timing attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Validates Telegram webhook secret token header.
 * Telegram sends this in header: X-Telegram-Bot-Api-Secret-Token
 */
export function validateTelegramWebhookSecret(
  headerToken: string | null | undefined,
  expectedSecret: string
): boolean {
  if (!headerToken || !expectedSecret) {
    return false;
  }
  return timingSafeEqual(headerToken.trim(), expectedSecret.trim());
}

/**
 * Validates whether the incoming Telegram sender/chat is the authorized owner.
 * Phase 1 is single-owner.
 */
export function isAuthorizedTelegramOwner(
  senderId: string | number | undefined | null,
  configuredOwnerId?: string
): boolean {
  if (!senderId) {
    return false;
  }
  if (!configuredOwnerId || configuredOwnerId.trim() === '') {
    // If no owner ID is explicitly configured, default to reject for security.
    return false;
  }
  return String(senderId).trim() === configuredOwnerId.trim();
}

/**
 * Validates an admin secret header for setup endpoints.
 */
export function validateAdminSecret(
  authHeader: string | null | undefined,
  configuredSecret: string
): boolean {
  if (!authHeader || !configuredSecret) {
    return false;
  }
  // Accepts either direct token or "Bearer <token>"
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : authHeader.trim();
  return timingSafeEqual(token, configuredSecret.trim());
}
