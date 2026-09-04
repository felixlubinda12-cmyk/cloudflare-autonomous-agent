import { ToolDefinition } from '../types.js';

export const listWorkersTool: ToolDefinition = {
  name: 'cloudflare_list_workers',
  description: 'Lists all Cloudflare Worker scripts deployed in the dedicated playground account.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  execute: async (_args, context) => {
    try {
      const workers = await context.cloudflare.listWorkers();
      return {
        success: true,
        data: {
          count: workers.length,
          workers: workers.map((w) => ({
            id: w.id,
            created_on: w.created_on,
            modified_on: w.modified_on,
            usage_model: w.usage_model,
          })),
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

export const getWorkerTool: ToolDefinition = {
  name: 'cloudflare_get_worker',
  description: 'Gets details and metadata for a specific Cloudflare Worker script.',
  parameters: {
    type: 'object',
    properties: {
      script_name: {
        type: 'string',
        description: 'The name / ID of the worker script to inspect.',
      },
    },
    required: ['script_name'],
  },
  execute: async (args, context) => {
    const scriptName = String(args.script_name || '').trim();
    if (!scriptName) {
      return { success: false, error: 'script_name is required' };
    }
    try {
      const worker = await context.cloudflare.getWorker(scriptName);
      return {
        success: true,
        data: worker,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};

export const getWorkerCodeTool: ToolDefinition = {
  name: 'cloudflare_get_worker_code',
  description: 'Fetches the source code of an existing Cloudflare Worker script.',
  parameters: {
    type: 'object',
    properties: {
      script_name: {
        type: 'string',
        description: 'The name of the worker script whose code to retrieve.',
      },
    },
    required: ['script_name'],
  },
  execute: async (args, context) => {
    const scriptName = String(args.script_name || '').trim();
    if (!scriptName) {
      return { success: false, error: 'script_name is required' };
    }
    try {
      const code = await context.cloudflare.getWorkerContent(scriptName);
      return {
        success: true,
        data: {
          script_name: scriptName,
          code,
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

export const createWorkerTool: ToolDefinition = {
  name: 'cloudflare_create_worker',
  description:
    'Creates a new Cloudflare Worker script with valid ES module JavaScript code (e.g. export default { async fetch(req, env) { ... } }).',
  parameters: {
    type: 'object',
    properties: {
      script_name: {
        type: 'string',
        description: 'The name of the worker script (letters, numbers, dashes).',
      },
      code: {
        type: 'string',
        description: 'Complete JavaScript ES module code for the worker.',
      },
      compatibility_date: {
        type: 'string',
        description: 'Compatibility date (optional, defaults to 2024-09-23).',
      },
    },
    required: ['script_name', 'code'],
  },
  execute: async (args, context) => {
    const scriptName = String(args.script_name || '').trim();
    const code = String(args.code || '').trim();
    const compatibilityDate = args.compatibility_date
      ? String(args.compatibility_date).trim()
      : undefined;

    if (!scriptName) {
      return { success: false, error: 'script_name is required' };
    }
    if (!code) {
      return { success: false, error: 'code is required' };
    }

    try {
      const result = await context.cloudflare.uploadWorkerScript(scriptName, code, {
        compatibilityDate,
      });
      return {
        success: true,
        data: {
          message: `Worker "${scriptName}" created and deployed successfully.`,
          worker: result,
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

export const updateWorkerTool: ToolDefinition = {
  name: 'cloudflare_update_worker',
  description: 'Updates and redeploys the code for an existing Cloudflare Worker script.',
  parameters: {
    type: 'object',
    properties: {
      script_name: {
        type: 'string',
        description: 'The name of the existing worker script to update.',
      },
      code: {
        type: 'string',
        description: 'The new JavaScript ES module code.',
      },
      compatibility_date: {
        type: 'string',
        description: 'Compatibility date (optional).',
      },
    },
    required: ['script_name', 'code'],
  },
  execute: async (args, context) => {
    const scriptName = String(args.script_name || '').trim();
    const code = String(args.code || '').trim();
    const compatibilityDate = args.compatibility_date
      ? String(args.compatibility_date).trim()
      : undefined;

    if (!scriptName) {
      return { success: false, error: 'script_name is required' };
    }
    if (!code) {
      return { success: false, error: 'code is required' };
    }

    try {
      const result = await context.cloudflare.uploadWorkerScript(scriptName, code, {
        compatibilityDate,
      });
      return {
        success: true,
        data: {
          message: `Worker "${scriptName}" updated and redeployed successfully.`,
          worker: result,
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

export const deleteWorkerTool: ToolDefinition = {
  name: 'cloudflare_delete_worker',
  description: 'Deletes a Cloudflare Worker script from the account. Destructive operation.',
  isDestructive: true,
  parameters: {
    type: 'object',
    properties: {
      script_name: {
        type: 'string',
        description: 'The name of the worker script to delete.',
      },
    },
    required: ['script_name'],
  },
  execute: async (args, context) => {
    const scriptName = String(args.script_name || '').trim();
    if (!scriptName) {
      return { success: false, error: 'script_name is required' };
    }
    try {
      await context.cloudflare.deleteWorker(scriptName);
      return {
        success: true,
        data: {
          message: `Worker "${scriptName}" has been deleted successfully.`,
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

export const getWorkerDeploymentsTool: ToolDefinition = {
  name: 'cloudflare_get_worker_deployments',
  description: 'Inspects deployment history and version details for a worker script.',
  parameters: {
    type: 'object',
    properties: {
      script_name: {
        type: 'string',
        description: 'The name of the worker script.',
      },
    },
    required: ['script_name'],
  },
  execute: async (args, context) => {
    const scriptName = String(args.script_name || '').trim();
    if (!scriptName) {
      return { success: false, error: 'script_name is required' };
    }
    try {
      const deployments = await context.cloudflare.getWorkerDeployments(scriptName);
      return {
        success: true,
        data: {
          script_name: scriptName,
          deployments,
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
