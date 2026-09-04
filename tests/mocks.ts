/**
 * In-memory mocks for Cloudflare Worker bindings (KV, D1, R2) for tests.
 */
export class MockKVNamespace {
  private store: Map<string, { value: string; expires?: number }> = new Map();

  async get(key: string): Promise<any> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expires && item.expires < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async put(key: string, value: any, options?: { expirationTtl?: number }): Promise<void> {
    const expires = options?.expirationTtl ? Date.now() + options.expirationTtl * 1000 : undefined;
    this.store.set(key, { value: String(value), expires });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(): Promise<any> {
    return { keys: Array.from(this.store.keys()).map((name) => ({ name })), list_complete: true };
  }

  async getWithMetadata(): Promise<any> {
    const val = await this.get(arguments[0]);
    return { value: val, metadata: null };
  }
}

export class MockD1PreparedStatement {
  private db: MockD1Database;
  private sql: string;
  private params: any[] = [];

  constructor(db: MockD1Database, sql: string, params: any[] = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }

  bind(...values: any[]): MockD1PreparedStatement {
    return new MockD1PreparedStatement(this.db, this.sql, values);
  }

  async first<T = unknown>(colName?: string): Promise<T | null> {
    const results = await this.db.executeMock(this.sql, this.params);
    if (results.length === 0) return null;
    if (colName) return results[0][colName];
    return results[0] as T;
  }

  async all<T = unknown>(): Promise<any> {
    const results = await this.db.executeMock(this.sql, this.params);
    return {
      results: results as T[],
      success: true,
      meta: { changes: 1, last_row_id: 1, duration: 1, served_by: 'mock', rows_read: results.length, rows_written: 1, size_after: 0 },
    };
  }

  async run<T = unknown>(): Promise<any> {
    await this.db.executeMock(this.sql, this.params);
    return {
      success: true,
      meta: { changes: 1, last_row_id: 1, duration: 1, served_by: 'mock', rows_read: 1, rows_written: 1, size_after: 0 },
    };
  }

  async raw(): Promise<any> {
    return [];
  }
}

export class MockD1Database {
  public tables: Map<string, any[]> = new Map([
    ['sessions', []],
    ['messages', []],
    ['agent_runs', []],
    ['tool_calls', []],
    ['memory_records', []],
  ]);

  prepare(query: string): any {
    return new MockD1PreparedStatement(this, query);
  }

  async batch<T = unknown>(statements: any[]): Promise<any[]> {
    const results: any[] = [];
    for (const stmt of statements) {
      results.push(await stmt.all());
    }
    return results;
  }

  async exec(query: string): Promise<any> {
    return { count: 1, duration: 1 };
  }

  async dump(): Promise<ArrayBuffer> {
    return new ArrayBuffer(0);
  }

  public async executeMock(sql: string, params: any[]): Promise<any[]> {
    const upper = sql.trim().toUpperCase();

    // SELECT 1 as healthy
    if (sql.includes('SELECT 1 as healthy')) {
      return [{ healthy: 1 }];
    }

    // CREATE TABLE / INDEX
    if (upper.startsWith('CREATE')) {
      return [];
    }

    // INSERT INTO sessions
    if (upper.includes('INSERT INTO SESSIONS')) {
      const row = {
        id: params[0],
        user_id: params[1],
        chat_id: params[2],
        status: params[3] || 'active',
        created_at: params[4],
        last_activity_at: params[5],
        metadata: params[6] || null,
      };
      this.tables.get('sessions')!.push(row);
      return [];
    }

    // SELECT FROM sessions
    if (upper.includes('FROM SESSIONS')) {
      const list = this.tables.get('sessions')!;
      if (upper.includes("WHERE USER_ID = ? AND CHAT_ID = ? AND STATUS = 'ACTIVE'")) {
        const found = list.filter((s) => s.user_id === params[0] && s.chat_id === params[1] && s.status === 'active');
        found.sort((a, b) => b.last_activity_at - a.last_activity_at);
        return found;
      }
      return list;
    }

    // UPDATE sessions
    if (upper.includes('UPDATE SESSIONS')) {
      const list = this.tables.get('sessions')!;
      if (upper.includes('SET LAST_ACTIVITY_AT = ? WHERE ID = ?')) {
        const item = list.find((s) => s.id === params[1]);
        if (item) item.last_activity_at = params[0];
      }
      if (upper.includes("SET STATUS = 'ARCHIVED'")) {
        list.forEach((s) => {
          if (s.user_id === params[0] && s.chat_id === params[1] && s.status === 'active') {
            s.status = 'archived';
          }
        });
      }
      return [];
    }

    // INSERT INTO messages
    if (upper.includes('INSERT INTO MESSAGES')) {
      const list = this.tables.get('messages')!;
      const row = {
        id: params[0],
        session_id: params[1],
        role: params[2],
        content: params[3],
        created_at: params[4],
        metadata: params[5],
        _seq: list.length,
      };
      list.push(row);
      return [];
    }

    // SELECT FROM messages
    if (upper.includes('FROM MESSAGES')) {
      const list = this.tables.get('messages')!.filter((m) => m.session_id === params[0]);
      const sorted = [...list].sort((a, b) => (b.created_at - a.created_at) || ((b._seq || 0) - (a._seq || 0)));
      const limit = params[1] || 10;
      return sorted.slice(0, limit);
    }

    // INSERT INTO agent_runs
    if (upper.includes('INSERT INTO AGENT_RUNS')) {
      const row = {
        id: params[0],
        session_id: params[1],
        user_request: params[2],
        status: params[3],
        iterations: params[4],
        created_at: params[5],
      };
      this.tables.get('agent_runs')!.push(row);
      return [];
    }

    // UPDATE agent_runs
    if (upper.includes('UPDATE AGENT_RUNS')) {
      const list = this.tables.get('agent_runs')!;
      const run = list.find((r) => r.id === params[params.length - 1]);
      if (run) {
        if (upper.includes('SET STATUS = ?') || upper.includes("SET STATUS = 'COMPLETED'")) {
          run.status = 'completed';
          run.iterations = params[0];
          run.completed_at = params[1];
        }
      }
      return [];
    }

    // INSERT INTO tool_calls
    if (upper.includes('INSERT INTO TOOL_CALLS')) {
      const row = {
        id: params[0],
        run_id: params[1],
        session_id: params[2],
        tool_name: params[3],
        arguments: params[4],
        result: params[5],
        is_error: params[6],
        created_at: params[7],
      };
      this.tables.get('tool_calls')!.push(row);
      return [];
    }

    // SELECT FROM memory_records
    if (upper.includes('FROM MEMORY_RECORDS')) {
      const list = this.tables.get('memory_records')!;
      if (upper.includes('WHERE KEY = ?')) {
        const found = list.filter((m) => m.key === params[0]);
        return found;
      }
      return list;
    }

    // INSERT INTO memory_records
    if (upper.includes('INSERT INTO MEMORY_RECORDS')) {
      const row = {
        id: params[0],
        category: params[1],
        key: params[2],
        content: params[3],
        created_at: params[4],
        updated_at: params[5],
      };
      this.tables.get('memory_records')!.push(row);
      return [];
    }

    // UPDATE memory_records
    if (upper.includes('UPDATE MEMORY_RECORDS')) {
      const list = this.tables.get('memory_records')!;
      const item = list.find((m) => m.key === params[3]);
      if (item) {
        item.content = params[0];
        item.category = params[1];
        item.updated_at = params[2];
      }
      return [];
    }

    // DELETE FROM memory_records
    if (upper.includes('DELETE FROM MEMORY_RECORDS')) {
      const list = this.tables.get('memory_records')!;
      const idx = list.findIndex((m) => m.key === params[0]);
      if (idx !== -1) list.splice(idx, 1);
      return [];
    }

    return [];
  }
}

export class MockR2Bucket {
  private objects: Map<string, { data: any; options?: any }> = new Map();

  async get(key: string): Promise<any> {
    const obj = this.objects.get(key);
    if (!obj) return null;
    return {
      key,
      text: async () => String(obj.data),
      json: async () => JSON.parse(String(obj.data)),
    };
  }

  async put(key: string, value: any, options?: any): Promise<any> {
    this.objects.set(key, { data: value, options });
    return { key };
  }

  async delete(keys: string | string[]): Promise<void> {
    const list = Array.isArray(keys) ? keys : [keys];
    list.forEach((k) => this.objects.delete(k));
  }

  async list(options?: any): Promise<any> {
    const objects = Array.from(this.objects.keys()).map((key) => ({ key }));
    return { objects, truncated: false };
  }

  async head(key: string): Promise<any> {
    return this.objects.has(key) ? { key } : null;
  }
}
