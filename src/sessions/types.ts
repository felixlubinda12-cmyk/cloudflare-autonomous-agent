export interface Session {
  id: string;
  userId: string;
  chatId: string;
  status: 'active' | 'archived';
  createdAt: number;
  lastActivityAt: number;
  metadata?: Record<string, unknown>;
}

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface Message {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
}
