export interface CloudflareApiResponse<T = unknown> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: Array<{ code: number; message: string }>;
  result: T;
}

export interface CloudflareWorkerSummary {
  id: string;
  etag?: string;
  created_on?: string;
  modified_on?: string;
  usage_model?: string;
  compatibility_date?: string;
  subdomain?: boolean;
}

export interface CloudflareSubdomain {
  subdomain: string;
}

export interface CloudflareDeployment {
  id: string;
  number?: number;
  created_on?: string;
  author_email?: string;
  source?: string;
  version?: string;
}
