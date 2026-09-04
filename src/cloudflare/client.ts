import { SecretRedactor } from '../security/secrets.js';
import {
  CloudflareApiResponse,
  CloudflareWorkerSummary,
  CloudflareSubdomain,
  CloudflareDeployment,
} from './types.js';

export class CloudflareApiError extends Error {
  public status: number;
  public errors: Array<{ code: number; message: string }>;

  constructor(
    message: string,
    status: number = 500,
    errors: Array<{ code: number; message: string }> = []
  ) {
    super(message);
    this.name = 'CloudflareApiError';
    this.status = status;
    this.errors = errors;
  }
}

export class CloudflareService {
  private apiToken: string;
  private accountId: string;
  private redactor: SecretRedactor;
  private baseUrl: string;

  constructor(
    apiToken: string,
    accountId: string,
    redactor?: SecretRedactor
  ) {
    this.apiToken = apiToken;
    this.accountId = accountId;
    this.redactor = redactor || new SecretRedactor([apiToken]);
    this.redactor.addSecret(apiToken);
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}`;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${this.apiToken}`);
    headers.set('User-Agent', 'CloudflareAutonomousAgent/1.0');

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Special case for script content endpoints which return plain text/javascript
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/javascript') || contentType.includes('text/plain')) {
        const text = await response.text();
        if (!response.ok) {
          throw new CloudflareApiError(
            `Cloudflare API error (${response.status}): ${this.redactor.redact(text)}`,
            response.status
          );
        }
        return text as unknown as T;
      }

      const data = (await response.json()) as CloudflareApiResponse<T>;
      if (!response.ok || !data.success) {
        const errMsg = data.errors && data.errors.length > 0
          ? data.errors.map((e) => `[${e.code}] ${e.message}`).join(', ')
          : `HTTP ${response.status} ${response.statusText}`;
        throw new CloudflareApiError(
          `Cloudflare API error: ${this.redactor.redact(errMsg)}`,
          response.status,
          data.errors || []
        );
      }
      return data.result;
    } catch (err) {
      if (err instanceof CloudflareApiError) {
        throw err;
      }
      const rawMsg = err instanceof Error ? err.message : String(err);
      throw new CloudflareApiError(
        `Cloudflare request failed: ${this.redactor.redact(rawMsg)}`,
        500
      );
    }
  }

  /**
   * List Workers in the account.
   * GET /client/v4/accounts/{account_id}/workers/scripts
   */
  public async listWorkers(): Promise<CloudflareWorkerSummary[]> {
    return await this.request<CloudflareWorkerSummary[]>('/workers/scripts');
  }

  /**
   * Get script metadata / details.
   * GET /client/v4/accounts/{account_id}/workers/scripts/{script_name}
   */
  public async getWorker(scriptName: string): Promise<CloudflareWorkerSummary> {
    const cleanName = encodeURIComponent(scriptName.trim());
    return await this.request<CloudflareWorkerSummary>(`/workers/scripts/${cleanName}`);
  }

  /**
   * Get script code/content.
   * GET /client/v4/accounts/{account_id}/workers/scripts/{script_name}/content
   */
  public async getWorkerContent(scriptName: string): Promise<string> {
    const cleanName = encodeURIComponent(scriptName.trim());
    return await this.request<string>(`/workers/scripts/${cleanName}/content`);
  }

  /**
   * Create or update worker code (deploy script).
   * Supports modern ES module format.
   * PUT /client/v4/accounts/{account_id}/workers/scripts/{script_name}
   */
  public async uploadWorkerScript(
    scriptName: string,
    code: string,
    options: {
      compatibilityDate?: string;
      mainModule?: string;
    } = {}
  ): Promise<CloudflareWorkerSummary> {
    const cleanName = encodeURIComponent(scriptName.trim());
    const mainModuleName = options.mainModule || 'index.js';
    const compatDate = options.compatibilityDate || '2024-09-23';

    // Cloudflare Workers REST API supports multipart/form-data for module upload
    const formData = new FormData();
    const metadata = {
      main_module: mainModuleName,
      compatibility_date: compatDate,
      compatibility_flags: ['nodejs_compat'],
    };

    formData.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );
    formData.append(
      mainModuleName,
      new Blob([code], { type: 'application/javascript+module' }),
      mainModuleName
    );

    return await this.request<CloudflareWorkerSummary>(`/workers/scripts/${cleanName}`, {
      method: 'PUT',
      body: formData,
    });
  }

  /**
   * Delete a worker script.
   * DELETE /client/v4/accounts/{account_id}/workers/scripts/{script_name}
   */
  public async deleteWorker(scriptName: string): Promise<{ id: string }> {
    const cleanName = encodeURIComponent(scriptName.trim());
    return await this.request<{ id: string }>(`/workers/scripts/${cleanName}`, {
      method: 'DELETE',
    });
  }

  /**
   * Inspect account workers.dev subdomain.
   * GET /client/v4/accounts/{account_id}/workers/subdomain
   */
  public async getWorkerSubdomain(): Promise<CloudflareSubdomain> {
    return await this.request<CloudflareSubdomain>('/workers/subdomain');
  }

  /**
   * Inspect deployments for a worker script.
   * GET /client/v4/accounts/{account_id}/workers/scripts/{script_name}/deployments
   */
  public async getWorkerDeployments(
    scriptName: string
  ): Promise<CloudflareDeployment[]> {
    const cleanName = encodeURIComponent(scriptName.trim());
    return await this.request<CloudflareDeployment[]>(
      `/workers/scripts/${cleanName}/deployments`
    );
  }

  /**
   * Health check connectivity test.
   */
  public async checkHealth(): Promise<boolean> {
    try {
      await this.listWorkers();
      return true;
    } catch (err) {
      console.error('Cloudflare health check error:', err);
      return false;
    }
  }
}
