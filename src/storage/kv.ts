/**
 * Cloudflare KV Storage abstraction
 * Used for fast key/value state, idempotency keys, and short-lived state.
 */
export class KvService {
  private kv: KVNamespace;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  /**
   * Checks if a Telegram update ID was already processed.
   * If not processed, stores it with TTL (default 24h) and returns true.
   * If already processed, returns false (duplicate).
   */
  public async checkAndRecordUpdateId(
    updateId: number,
    ttlSeconds: number = 86400
  ): Promise<boolean> {
    const key = `update_id:${updateId}`;
    try {
      const existing = await this.kv.get(key);
      if (existing !== null) {
        return false; // Duplicate
      }
      await this.kv.put(key, String(Date.now()), {
        expirationTtl: ttlSeconds,
      });
      return true;
    } catch (err) {
      // In case of KV transient read error, proceed with caution
      console.error('KV idempotency check error:', err);
      return true;
    }
  }

  public async get<T = string>(key: string): Promise<T | null> {
    const val = await this.kv.get(key);
    if (val === null) return null;
    try {
      return JSON.parse(val) as T;
    } catch {
      return val as unknown as T;
    }
  }

  public async set(
    key: string,
    value: unknown,
    ttlSeconds?: number
  ): Promise<void> {
    const valStr = typeof value === 'string' ? value : JSON.stringify(value);
    const options = ttlSeconds ? { expirationTtl: ttlSeconds } : undefined;
    await this.kv.put(key, valStr, options);
  }

  public async delete(key: string): Promise<void> {
    await this.kv.delete(key);
  }
}
