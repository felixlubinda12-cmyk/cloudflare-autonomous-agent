import { ToolDefinition } from '../types.js';

export const createPullRequestTool: ToolDefinition = {
  name: 'github_create_pull_request',
  description:
    'Creates a pull request in the dedicated playground repository.',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Title of the pull request.',
      },
      head: {
        type: 'string',
        description: 'Branch containing the proposed changes (e.g. "feature/test").',
      },
      base: {
        type: 'string',
        description: 'Branch to merge changes into (e.g. "main").',
      },
      body: {
        type: 'string',
        description: 'Description of changes and context for the pull request.',
      },
    },
    required: ['title', 'head', 'base'],
  },
  execute: async (args, context) => {
    if (!context.github || !context.github.isConfigured()) {
      return {
        success: false,
        error:
          'GitHub playground repository is not configured. Missing GITHUB_TOKEN.',
      };
    }
    try {
      const pr = await context.github.createPullRequest({
        title: args.title as string,
        head: args.head as string,
        base: args.base as string,
        body: args.body as string | undefined,
      });
      return { success: true, data: pr };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  },
};

export const getPullRequestTool: ToolDefinition = {
  name: 'github_get_pull_request',
  description:
    'Inspects details, state, and mergeability of a specific pull request in the playground repository.',
  parameters: {
    type: 'object',
    properties: {
      pull_number: {
        type: 'string',
        description: 'The pull request number (e.g. 1).',
      },
    },
    required: ['pull_number'],
  },
  execute: async (args, context) => {
    if (!context.github || !context.github.isConfigured()) {
      return {
        success: false,
        error:
          'GitHub playground repository is not configured. Missing GITHUB_TOKEN.',
      };
    }
    try {
      const pullNum = parseInt(String(args.pull_number), 10);
      if (isNaN(pullNum)) {
        return { success: false, error: 'Invalid pull_number provided.' };
      }
      const pr = await context.github.getPullRequest(pullNum);
      return { success: true, data: pr };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  },
};

export const listPullRequestsTool: ToolDefinition = {
  name: 'github_list_pull_requests',
  description:
    'Lists pull requests in the playground repository.',
  parameters: {
    type: 'object',
    properties: {
      state: {
        type: 'string',
        description: 'Filter state: "open", "closed", or "all" (default: "open").',
      },
      limit: {
        type: 'string',
        description: 'Maximum number of PRs to return (default: 10).',
      },
    },
  },
  execute: async (args, context) => {
    if (!context.github || !context.github.isConfigured()) {
      return {
        success: false,
        error:
          'GitHub playground repository is not configured. Missing GITHUB_TOKEN.',
      };
    }
    try {
      const limit = args.limit ? parseInt(String(args.limit), 10) : 10;
      const state = (args.state as 'open' | 'closed' | 'all') || 'open';
      const prs = await context.github.listPullRequests({
        state,
        limit: isNaN(limit) ? 10 : limit,
      });
      return { success: true, data: prs };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  },
};
