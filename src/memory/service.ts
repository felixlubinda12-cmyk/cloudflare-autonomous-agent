import { D1Service } from '../storage/d1.js';
import { MemoryRecord, MemoryCategory } from './types.js';

export class MemoryService {
  private d1: D1Service;

  constructor(d1: D1Service) {
    this.d1 = d1;
  }

  /**
   * Saves or updates a persistent memory record in D1.
   */
  public async saveMemory(
    key: string,
    content: string,
    category: MemoryCategory = 'general'
  ): Promise<MemoryRecord> {
    const now = Date.now();
    const cleanKey = key.trim().toLowerCase();

    const existing = await this.d1.db
      .prepare(`SELECT id FROM memory_records WHERE key = ?`)
      .bind(cleanKey)
      .first<{ id: string }>();

    if (existing) {
      await this.d1.db
        .prepare(
          `UPDATE memory_records
           SET content = ?, category = ?, updated_at = ?
           WHERE key = ?`
        )
        .bind(content, category, now, cleanKey)
        .run();

      return {
        id: existing.id,
        category,
        key: cleanKey,
        content,
        createdAt: now,
        updatedAt: now,
      };
    }

    const id = crypto.randomUUID();
    await this.d1.db
      .prepare(
        `INSERT INTO memory_records (id, category, key, content, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(id, category, cleanKey, content, now, now)
      .run();

    return {
      id,
      category,
      key: cleanKey,
      content,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Retrieves a memory record by key.
   */
  public async getMemory(key: string): Promise<MemoryRecord | null> {
    const cleanKey = key.trim().toLowerCase();
    const row = await this.d1.db
      .prepare(
        `SELECT id, category, key, content, created_at, updated_at
         FROM memory_records
         WHERE key = ?`
      )
      .bind(cleanKey)
      .first<{
        id: string;
        category: string;
        key: string;
        content: string;
        created_at: number;
        updated_at: number;
      }>();

    if (!row) return null;
    return {
      id: row.id,
      category: row.category as MemoryCategory,
      key: row.key,
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Searches memories matching a query across key and content.
   */
  public async searchMemories(query: string, limit: number = 10): Promise<MemoryRecord[]> {
    const pattern = `%${query.trim().toLowerCase()}%`;
    const rows = await this.d1.db
      .prepare(
        `SELECT id, category, key, content, created_at, updated_at
         FROM memory_records
         WHERE key LIKE ? OR content LIKE ?
         ORDER BY updated_at DESC
         LIMIT ?`
      )
      .bind(pattern, pattern, limit)
      .all<{
        id: string;
        category: string;
        key: string;
        content: string;
        created_at: number;
        updated_at: number;
      }>();

    return (rows.results || []).map((r) => ({
      id: r.id,
      category: r.category as MemoryCategory,
      key: r.key,
      content: r.content,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  /**
   * Lists memory records, optionally filtered by category.
   */
  public async listMemories(
    category?: MemoryCategory,
    limit: number = 20
  ): Promise<MemoryRecord[]> {
    let query = `SELECT id, category, key, content, created_at, updated_at FROM memory_records`;
    const params: unknown[] = [];
    if (category) {
      query += ` WHERE category = ?`;
      params.push(category);
    }
    query += ` ORDER BY updated_at DESC LIMIT ?`;
    params.push(limit);

    const rows = await this.d1.db
      .prepare(query)
      .bind(...params)
      .all<{
        id: string;
        category: string;
        key: string;
        content: string;
        created_at: number;
        updated_at: number;
      }>();

    return (rows.results || []).map((r) => ({
      id: r.id,
      category: r.category as MemoryCategory,
      key: r.key,
      content: r.content,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  /**
   * Deletes a memory record by key.
   */
  public async deleteMemory(key: string): Promise<boolean> {
    const cleanKey = key.trim().toLowerCase();
    const res = await this.d1.db
      .prepare(`DELETE FROM memory_records WHERE key = ?`)
      .bind(cleanKey)
      .run();
    return (res.meta?.changes ?? 0) > 0;
  }
}
