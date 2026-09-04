/**
 * Cloudflare D1 Database Storage abstraction
 * Used for persistent structured relational application data.
 */
export class D1Service {
  public db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * Self-healing initial schema creation.
   * Ensures all Phase 1 tables and indexes exist without failing if already present.
   */
  public async ensureSchema(): Promise<void> {
    const statements = [
      `CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        chat_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL,
        last_activity_at INTEGER NOT NULL,
        metadata TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        metadata TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS agent_runs (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        user_request TEXT NOT NULL,
        status TEXT NOT NULL,
        iterations INTEGER NOT NULL DEFAULT 0,
        error TEXT,
        created_at INTEGER NOT NULL,
        completed_at INTEGER
      );`,
      `CREATE TABLE IF NOT EXISTS tool_calls (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
        session_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        arguments TEXT NOT NULL,
        result TEXT,
        is_error INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS memory_records (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL DEFAULT 'general',
        key TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);`,
      `CREATE INDEX IF NOT EXISTS idx_agent_runs_session ON agent_runs(session_id);`,
      `CREATE INDEX IF NOT EXISTS idx_tool_calls_run ON tool_calls(run_id);`,
      `CREATE INDEX IF NOT EXISTS idx_memory_category ON memory_records(category);`,
    ];

    try {
      const batch = statements.map((sql) => this.db.prepare(sql));
      await this.db.batch(batch);
    } catch (err) {
      console.error('D1 schema bootstrap error:', err);
      throw err;
    }
  }

  /**
   * Simple connectivity probe for health checks.
   */
  public async checkHealth(): Promise<boolean> {
    try {
      const result = await this.db.prepare('SELECT 1 as healthy').first<{ healthy: number }>();
      return result?.healthy === 1;
    } catch (err) {
      console.error('D1 health check failed:', err);
      return false;
    }
  }
}
