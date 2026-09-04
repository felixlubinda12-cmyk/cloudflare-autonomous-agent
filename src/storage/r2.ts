/**
 * Cloudflare R2 Storage abstraction
 * Used for persistent object / artifact storage.
 */
export class R2Service {
  private bucket: R2Bucket;

  constructor(bucket: R2Bucket) {
    this.bucket = bucket;
  }

  public async put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob,
    options?: R2PutOptions
  ): Promise<R2Object> {
    return await this.bucket.put(key, value, options);
  }

  public async get(key: string): Promise<R2ObjectBody | null> {
    return await this.bucket.get(key);
  }

  public async getText(key: string): Promise<string | null> {
    const obj = await this.bucket.get(key);
    if (!obj) return null;
    return await obj.text();
  }

  public async delete(key: string | string[]): Promise<void> {
    await this.bucket.delete(key);
  }

  public async list(options?: R2ListOptions): Promise<R2Objects> {
    return await this.bucket.list(options);
  }

  /**
   * Health check connectivity test for R2.
   */
  public async checkHealth(): Promise<boolean> {
    try {
      await this.bucket.list({ limit: 1 });
      return true;
    } catch (err) {
      console.error('R2 health check error:', err);
      return false;
    }
  }
}
