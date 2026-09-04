import { ToolDefinition } from '../types.js';
import { MemoryCategory } from '../../memory/types.js';

export const saveMemoryTool: ToolDefinition = {
  name: 'memory_save',
  description:
    'Explicitly stores an important user preference, project decision, or key fact into long-term persistent memory.',
  parameters: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'A concise unique identifier for the memory (e.g. "user_timezone", "preferred_style").',
      },
      content: {
        type: 'string',
        description: 'The detail or fact to remember.',
      },
      category: {
        type: 'string',
        enum: ['preference', 'fact', 'decision', 'config', 'general'],
        description: 'Category of memory.',
      },
    },
    required: ['key', 'content'],
  },
  execute: async (args, context) => {
    const key = String(args.key || '').trim();
    const content = String(args.content || '').trim();
    const category = (args.category as MemoryCategory) || 'general';

    if (!key || !content) {
      return { success: false, error: 'key and content are required' };
    }

    try {
      const record = await context.memory.saveMemory(key, content, category);
      return {
        success: true,
        data: {
          message: `Memory "${record.key}" saved successfully.`,
          record,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};

export const searchMemoryTool: ToolDefinition = {
  name: 'memory_search',
  description: 'Searches persistent long-term memories matching a query.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Keywords to search in stored memories.',
      },
    },
    required: ['query'],
  },
  execute: async (args, context) => {
    const query = String(args.query || '').trim();
    if (!query) {
      return { success: false, error: 'query is required' };
    }
    try {
      const records = await context.memory.searchMemories(query);
      return {
        success: true,
        data: {
          count: records.length,
          memories: records,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};

export const listMemoriesTool: ToolDefinition = {
  name: 'memory_list',
  description: 'Lists stored persistent memories, optionally filtered by category.',
  parameters: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: ['preference', 'fact', 'decision', 'config', 'general'],
        description: 'Optional category filter.',
      },
    },
    required: [],
  },
  execute: async (args, context) => {
    try {
      const category = args.category ? (args.category as MemoryCategory) : undefined;
      const records = await context.memory.listMemories(category);
      return {
        success: true,
        data: {
          count: records.length,
          memories: records,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};

export const deleteMemoryTool: ToolDefinition = {
  name: 'memory_delete',
  description: 'Deletes a persistent memory record by its key.',
  isDestructive: true,
  parameters: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'The key of the memory to delete.',
      },
    },
    required: ['key'],
  },
  execute: async (args, context) => {
    const key = String(args.key || '').trim();
    if (!key) {
      return { success: false, error: 'key is required' };
    }
    try {
      const deleted = await context.memory.deleteMemory(key);
      return {
        success: true,
        data: {
          message: deleted
            ? `Memory "${key}" deleted successfully.`
            : `Memory "${key}" not found.`,
          deleted,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
