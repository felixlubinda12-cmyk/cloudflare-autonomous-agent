export type MemoryCategory =
  | 'preference'
  | 'fact'
  | 'decision'
  | 'config'
  | 'general';

export interface MemoryRecord {
  id: string;
  category: MemoryCategory;
  key: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}
