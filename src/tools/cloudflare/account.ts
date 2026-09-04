import { ToolDefinition } from '../types.js';

export const getSubdomainTool: ToolDefinition = {
  name: 'cloudflare_get_subdomain',
  description: 'Inspects the dedicated Cloudflare playground account workers.dev subdomain.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  execute: async (_args, context) => {
    try {
      const subdomain = await context.cloudflare.getWorkerSubdomain();
      return {
        success: true,
        data: subdomain,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
