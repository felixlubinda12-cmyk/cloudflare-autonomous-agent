import { D1Service } from '../storage/d1.js';
import { Session, Message, MessageRole } from './types.js';

export class SessionService {
  private d1: D1Service;

  constructor(d1: D1Service) {
    this.d1 = d1;
  }

  /**
   * Retrieves the current active session for the user and chat, or creates a new one.
   */
  public async getOrCreateSession(
    userId: string,
    chatId: string
  ): Promise<Session> {
    const now = Date.now();
    const existing = await this.d1.db
      .prepare(
        `SELECT id, user_id, chat_id, status, created_at, last_activity_at, metadata
         FROM sessions
         WHERE user_id = ? AND chat_id = ? AND status = 'active'
         ORDER BY last_activity_at DESC
         LIMIT 1`
      )
      .bind(userId, chatId)
      .first<{
        id: string;
        user_id: string;
        chat_id: string;
        status: string;
        created_at: number;
        last_activity_at: number;
        metadata: string | null;
      }>();

    if (existing) {
      await this.d1.db
        .prepare(`UPDATE sessions SET last_activity_at = ? WHERE id = ?`)
        .bind(now, existing.id)
        .run();

      let metadata: Record<string, unknown> | undefined;
      try {
        if (existing.metadata) metadata = JSON.parse(existing.metadata);
      } catch {
        // ignore parse error
      }

      return {
        id: existing.id,
        userId: existing.user_id,
        chatId: existing.chat_id,
        status: existing.status as 'active' | 'archived',
        createdAt: existing.created_at,
        lastActivityAt: now,
        metadata,
      };
    }

    // Create new session
    const id = crypto.randomUUID();
    await this.d1.db
      .prepare(
        `INSERT INTO sessions (id, user_id, chat_id, status, created_at, last_activity_at, metadata)
         VALUES (?, ?, ?, 'active', ?, ?, ?)`
      )
      .bind(id, userId, chatId, now, now, null)
      .run();

    return {
      id,
      userId,
      chatId,
      status: 'active',
      createdAt: now,
      lastActivityAt: now,
    };
  }

  /**
   * Archives current active sessions for the user and creates a fresh session.
   */
  public async resetSession(
    userId: string,
    chatId: string
  ): Promise<Session> {
    const now = Date.now();
    await this.d1.db
      .prepare(
        `UPDATE sessions SET status = 'archived'
         WHERE user_id = ? AND chat_id = ? AND status = 'active'`
      )
      .bind(userId, chatId)
      .run();

    const newSessionId = crypto.randomUUID();
    await this.d1.db
      .prepare(
        `INSERT INTO sessions (id, user_id, chat_id, status, created_at, last_activity_at, metadata)
         VALUES (?, ?, ?, 'active', ?, ?, ?)`
      )
      .bind(newSessionId, userId, chatId, now, now, null)
      .run();

    return {
      id: newSessionId,
      userId,
      chatId,
      status: 'active',
      createdAt: now,
      lastActivityAt: now,
    };
  }

  /**
   * Adds a message to the session history in D1.
   */
  public async addMessage(
    sessionId: string,
    role: MessageRole,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<Message> {
    const id = crypto.randomUUID();
    const now = Date.now();
    const metaStr = metadata ? JSON.stringify(metadata) : null;

    await this.d1.db
      .prepare(
        `INSERT INTO messages (id, session_id, role, content, created_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(id, sessionId, role, content, now, metaStr)
      .run();

    return {
      id,
      sessionId,
      role,
      content,
      createdAt: now,
      metadata,
    };
  }

  /**
   * Fetches recent messages for a session (oldest first for prompt context).
   */
  public async getRecentMessages(
    sessionId: string,
    limit: number = 10
  ): Promise<Message[]> {
    const results = await this.d1.db
      .prepare(
        `SELECT id, session_id, role, content, created_at, metadata
         FROM messages
         WHERE session_id = ?
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .bind(sessionId, limit)
      .all<{
        id: string;
        session_id: string;
        role: string;
        content: string;
        created_at: number;
        metadata: string | null;
      }>();

    const rows = results.results || [];
    // Return in chronological order
    return rows
      .reverse()
      .map((r) => {
        let metadata: Record<string, unknown> | undefined;
        try {
          if (r.metadata) metadata = JSON.parse(r.metadata);
        } catch {
          // ignore
        }
        return {
          id: r.id,
          sessionId: r.session_id,
          role: r.role as MessageRole,
          content: r.content,
          createdAt: r.created_at,
          metadata,
        };
      });
  }
}
