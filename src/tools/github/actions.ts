import { ToolDefinition } from '../types.js';

export const listWorkflowsTool: ToolDefinition = {
  name: 'github_list_workflows',
  description:
    'Lists GitHub Actions workflows configured in the playground repository.',
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
      const workflows = await context.github.listWorkflows();
      return { success: true, data: workflows };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  },
};

export const getWorkflowTool: ToolDefinition = {
  name: 'github_get_workflow',
  description:
    'Inspects details of a specific GitHub Actions workflow by its ID or workflow filename (e.g. "ci.yml").',
  parameters: {
    type: 'object',
    properties: {
      workflow_id: {
        type: 'string',
        description: 'Workflow ID or filename (e.g. "deploy.yml", 1234567).',
      },
    },
    required: ['workflow_id'],
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
      const wf = await context.github.getWorkflow(args.workflow_id as string);
      return { success: true, data: wf };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  },
};

export const triggerWorkflowTool: ToolDefinition = {
  name: 'github_trigger_workflow',
  description:
    'Manually dispatches a workflow run via workflow_dispatch event in the playground repository.',
  parameters: {
    type: 'object',
    properties: {
      workflow_id: {
        type: 'string',
        description: 'Workflow ID or filename (e.g. "ci.yml", "test.yml").',
      },
      ref: {
        type: 'string',
        description: 'Git ref (branch name or tag) on which to trigger the workflow.',
      },
      inputs: {
        type: 'object',
        description: 'Key-value input parameters defined in the workflow file (optional).',
      },
    },
    required: ['workflow_id', 'ref'],
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
      const res = await context.github.triggerWorkflow({
        workflowId: args.workflow_id as string,
        ref: args.ref as string,
        inputs: args.inputs as Record<string, unknown> | undefined,
      });
      return { success: true, data: res };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  },
};

export const listWorkflowRunsTool: ToolDefinition = {
  name: 'github_list_workflow_runs',
  description:
    'Lists GitHub Actions workflow runs in the playground repository with status and conclusion.',
  parameters: {
    type: 'object',
    properties: {
      workflow_id: {
        type: 'string',
        description: 'Filter by specific workflow ID or filename (optional).',
      },
      branch: {
        type: 'string',
        description: 'Filter runs by git branch (optional).',
      },
      status: {
        type: 'string',
        description: 'Filter by status: "completed", "in_progress", "queued" (optional).',
      },
      limit: {
        type: 'string',
        description: 'Max runs to return (default: 10).',
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
      const runs = await context.github.listWorkflowRuns({
        workflowId: args.workflow_id as string | undefined,
        branch: args.branch as string | undefined,
        status: args.status as string | undefined,
        limit: isNaN(limit) ? 10 : limit,
      });
      return { success: true, data: runs };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  },
};

export const getWorkflowRunTool: ToolDefinition = {
  name: 'github_get_workflow_run',
  description:
    'Inspects a workflow run, its jobs, and individual job steps in the playground repository.',
  parameters: {
    type: 'object',
    properties: {
      run_id: {
        type: 'string',
        description: 'The numeric ID of the workflow run.',
      },
    },
    required: ['run_id'],
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
      const runId = parseInt(String(args.run_id), 10);
      if (isNaN(runId)) {
        return { success: false, error: 'Invalid run_id provided.' };
      }
      const data = await context.github.getWorkflowRun(runId);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  },
};

export const getWorkflowRunLogsTool: ToolDefinition = {
  name: 'github_get_workflow_run_logs',
  description:
    'Retrieves concise execution summary and failure points of a workflow run, pinpointing failed steps.',
  parameters: {
    type: 'object',
    properties: {
      run_id: {
        type: 'string',
        description: 'The numeric ID of the workflow run.',
      },
    },
    required: ['run_id'],
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
      const runId = parseInt(String(args.run_id), 10);
      if (isNaN(runId)) {
        return { success: false, error: 'Invalid run_id provided.' };
      }
      const data = await context.github.getWorkflowRunLogs(runId);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  },
};
