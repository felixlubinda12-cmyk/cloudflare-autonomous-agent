import { ToolDefinition } from '../types.js';

export const getRepositoryTool: ToolDefinition = {
  name: 'github_get_repository',
  description:
    'Inspects metadata of the dedicated GitHub playground repository, including full name, default branch, star count, and description.',
  parameters: {
    type: 'object',
    properties: {},
  },
  execute: async (_args, context) => {
    if (!context.github || !context.github.isConfigured()) {
      return {
        success: false,
        error:
          'GitHub playground repository is not configured. Missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPOSITORY.',
      };
    }
    try {
      const repo = await context.github.getRepository();
      return { success: true, data: repo };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  },
};

export const listContentsTool: ToolDefinition = {
  name: 'github_list_contents',
  description:
    'Lists files and directories at a specified path in the dedicated playground repository.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Directory path in the repository (e.g. "src" or "" for root).',
      },
      ref: {
        type: 'string',
        description: 'Branch name, tag, or commit SHA (optional, defaults to default branch).',
      },
    },
  },
  execute: async (args, context) => {
    if (!context.github || !context.github.isConfigured()) {
      return {
        success: false,
        error:
          'GitHub playground repository is not configured. Missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPOSITORY.',
      };
    }
    try {
      const path = (args.path as string) || '';
      const ref = args.ref as string | undefined;
      const contents = await context.github.listContents(path, ref);
      return { success: true, data: contents };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  },
};

export const getFileTool: ToolDefinition = {
  name: 'github_get_file',
  description:
    'Reads and returns decoded text content of a file from the dedicated playground repository. Safely truncated if exceptionally large.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative path of the file to read (e.g. "src/index.js", "package.json").',
      },
      ref: {
        type: 'string',
        description: 'Branch name, tag, or commit SHA (optional).',
      },
    },
    required: ['path'],
  },
  execute: async (args, context) => {
    if (!context.github || !context.github.isConfigured()) {
      return {
        success: false,
        error:
          'GitHub playground repository is not configured. Missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPOSITORY.',
      };
    }
    try {
      const path = args.path as string;
      const ref = args.ref as string | undefined;
      const file = await context.github.getFile(path, ref);
      return { success: true, data: file };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  },
};

export const searchCodeTool: ToolDefinition = {
  name: 'github_search_code',
  description:
    'Searches for code or filenames strictly within the dedicated playground repository.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Code search query keyword or filename (e.g. "export default", "wrangler").',
      },
    },
    required: ['query'],
  },
  execute: async (args, context) => {
    if (!context.github || !context.github.isConfigured()) {
      return {
        success: false,
        error:
          'GitHub playground repository is not configured. Missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPOSITORY.',
      };
    }
    try {
      const query = args.query as string;
      const results = await context.github.searchCode(query);
      return { success: true, data: results };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  },
};

export const createOrUpdateFileTool: ToolDefinition = {
  name: 'github_create_or_update_file',
  description:
    'Creates or updates a file in the dedicated playground repository and commits the changes.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative path where the file should be created or updated.',
      },
      content: {
        type: 'string',
        description: 'Plaintext file content to write.',
      },
      message: {
        type: 'string',
        description: 'Git commit message describing the change.',
      },
      branch: {
        type: 'string',
        description: 'Target branch name (optional, defaults to repository default branch).',
      },
      sha: {
        type: 'string',
        description: 'SHA of the existing file being replaced (optional; auto-detected if omitted).',
      },
    },
    required: ['path', 'content', 'message'],
  },
  execute: async (args, context) => {
    if (!context.github || !context.github.isConfigured()) {
      return {
        success: false,
        error:
          'GitHub playground repository is not configured. Missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPOSITORY.',
      };
    }
    try {
      const res = await context.github.createOrUpdateFile({
        path: args.path as string,
        content: args.content as string,
        message: args.message as string,
        branch: args.branch as string | undefined,
        sha: args.sha as string | undefined,
      });
      return { success: true, data: res };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  },
};

export const deleteFileTool: ToolDefinition = {
  name: 'github_delete_file',
  description:
    'Deletes a file from the dedicated playground repository and commits the removal.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative path of the file to delete.',
      },
      message: {
        type: 'string',
        description: 'Git commit message explaining the deletion.',
      },
      sha: {
        type: 'string',
        description: 'SHA of the file being deleted.',
      },
      branch: {
        type: 'string',
        description: 'Target branch name (optional).',
      },
    },
    required: ['path', 'message', 'sha'],
  },
  execute: async (args, context) => {
    if (!context.github || !context.github.isConfigured()) {
      return {
        success: false,
        error:
          'GitHub playground repository is not configured. Missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPOSITORY.',
      };
    }
    try {
      const res = await context.github.deleteFile({
        path: args.path as string,
        message: args.message as string,
        sha: args.sha as string,
        branch: args.branch as string | undefined,
      });
      return { success: true, data: res };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  },
};

export const listCommitsTool: ToolDefinition = {
  name: 'github_list_commits',
  description:
    'Lists recent git commits on the playground repository.',
  parameters: {
    type: 'object',
    properties: {
      branch: {
        type: 'string',
        description: 'Branch name or commit SHA to start from (optional).',
      },
      path: {
        type: 'string',
        description: 'Filter commits to those touching a specific file path (optional).',
      },
      limit: {
        type: 'string',
        description: 'Maximum number of commits to return (default: 10).',
      },
    },
  },
  execute: async (args, context) => {
    if (!context.github || !context.github.isConfigured()) {
      return {
        success: false,
        error:
          'GitHub playground repository is not configured. Missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPOSITORY.',
      };
    }
    try {
      const limit = args.limit ? parseInt(String(args.limit), 10) : 10;
      const commits = await context.github.listCommits({
        branch: args.branch as string | undefined,
        path: args.path as string | undefined,
        limit: isNaN(limit) ? 10 : limit,
      });
      return { success: true, data: commits };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  },
};

export const getCommitTool: ToolDefinition = {
  name: 'github_get_commit',
  description:
    'Inspects details of a specific commit in the playground repository, including changed files and stats.',
  parameters: {
    type: 'object',
    properties: {
      ref: {
        type: 'string',
        description: 'Commit SHA, branch name, or tag.',
      },
    },
    required: ['ref'],
  },
  execute: async (args, context) => {
    if (!context.github || !context.github.isConfigured()) {
      return {
        success: false,
        error:
          'GitHub playground repository is not configured. Missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPOSITORY.',
      };
    }
    try {
      const commit = await context.github.getCommit(args.ref as string);
      return { success: true, data: commit };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  },
};

export const listBranchesTool: ToolDefinition = {
  name: 'github_list_branches',
  description:
    'Lists git branches in the playground repository.',
  parameters: {
    type: 'object',
    properties: {
      limit: {
        type: 'string',
        description: 'Max number of branches to return (default 20).',
      },
    },
  },
  execute: async (args, context) => {
    if (!context.github || !context.github.isConfigured()) {
      return {
        success: false,
        error:
          'GitHub playground repository is not configured. Missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPOSITORY.',
      };
    }
    try {
      const limit = args.limit ? parseInt(String(args.limit), 10) : 20;
      const branches = await context.github.listBranches(isNaN(limit) ? 20 : limit);
      return { success: true, data: branches };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  },
};

export const createBranchTool: ToolDefinition = {
  name: 'github_create_branch',
  description:
    'Creates a new git branch in the playground repository based on the default branch or a specified commit/branch.',
  parameters: {
    type: 'object',
    properties: {
      branch_name: {
        type: 'string',
        description: 'Name for the new branch (e.g. "feature/fix-auth").',
      },
      from_branch: {
        type: 'string',
        description: 'Base branch or commit SHA to branch off from (optional, defaults to repository default branch).',
      },
    },
    required: ['branch_name'],
  },
  execute: async (args, context) => {
    if (!context.github || !context.github.isConfigured()) {
      return {
        success: false,
        error:
          'GitHub playground repository is not configured. Missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPOSITORY.',
      };
    }
    try {
      const res = await context.github.createBranch(
        args.branch_name as string,
        args.from_branch as string | undefined
      );
      return { success: true, data: res };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  },
};
