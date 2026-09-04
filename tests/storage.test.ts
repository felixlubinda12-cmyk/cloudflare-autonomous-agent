import { describe, it, expect, beforeEach } from 'vitest';
import { MockKVNamespace, MockD1Database, MockR2Bucket } from './mocks.js';
import { KvService } from '../src/storage/kv.js';
import { D1Service } from '../src/storage/d1.js';
import { R2Service } from '../src/storage/r2.js';
import { SessionService } from '../src/sessions/service.js';
import { MemoryService } from '../src/memory/service.js';

describe('Storage Services (KV, D1, R2)', () => {
  let mockKV: MockKVNamespace;
  let mockD1: MockD1Database;
  let mockR2: MockR2Bucket;

  beforeEach(() => {
    mockKV = new MockKVNamespace();
    mockD1 = new MockD1Database();
    mockR2 = new MockR2Bucket();
  });

  describe('KV Idempotency', () => {
    it('records new update_id and blocks duplicate update_id', async () => {
      const kv = new KvService(mockKV as any);
      const isNewFirst = await kv.checkAndRecordUpdateId(1001);
      expect(isNewFirst).toBe(true);
      const isNewSecond = await kv.checkAndRecordUpdateId(1001);
      expect(isNewSecond).toBe(false);
      const differentUpdate = await kv.checkAndRecordUpdateId(1002);
      expect(differentUpdate).toBe(true);
    });
  });

  describe('D1 Sessions and Messages', () => {
    it('creates and retrieves sessions and stores messages', async () => {
      const d1 = new D1Service(mockD1 as any);
      const sessions = new SessionService(d1);
      const session = await sessions.getOrCreateSession('user-1', 'chat-1');
      expect(session.id).toBeDefined();
      expect(session.userId).toBe('user-1');
      expect(session.status).toBe('active');

      await sessions.addMessage(session.id, 'user', 'Hello agent');
      await sessions.addMessage(session.id, 'assistant', 'Hello user! How can I help?');

      const messages = await sessions.getRecentMessages(session.id);
      expect(messages.length).toBe(2);
      expect(messages[0].content).toBe('Hello agent');
      expect(messages[1].content).toBe('Hello user! How can I help?');
    });

    it('resets sessions cleanly', async () => {
      const d1 = new D1Service(mockD1 as any);
      const sessions = new SessionService(d1);
      const s1 = await sessions.getOrCreateSession('user-1', 'chat-1');
      const s2 = await sessions.resetSession('user-1', 'chat-1');
      expect(s1.id).not.toBe(s2.id);
      expect(s2.status).toBe('active');
    });
  });

  describe('D1 Memory Service', () => {
    it('saves, searches, and lists persistent memory', async () => {
      const d1 = new D1Service(mockD1 as any);
      const memory = new MemoryService(d1);
      const saved = await memory.saveMemory('preferred_region', 'Europe', 'preference');
      expect(saved.key).toBe('preferred_region');
      expect(saved.content).toBe('Europe');

      const retrieved = await memory.getMemory('preferred_region');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.content).toBe('Europe');

      const all = await memory.listMemories();
      expect(all.length).toBe(1);

      const deleted = await memory.deleteMemory('preferred_region');
      expect(deleted).toBe(true);
    });
  });

  describe('R2 Object Storage', () => {
    it('puts, gets, and deletes objects', async () => {
      const r2 = new R2Service(mockR2 as any);
      await r2.put('test-file.txt', 'sample artifact content');
      const content = await r2.getText('test-file.txt');
      expect(content).toBe('sample artifact content');
      await r2.delete('test-file.txt');
      const afterDelete = await r2.get('test-file.txt');
      expect(afterDelete).toBeNull();
    });
  });
});
