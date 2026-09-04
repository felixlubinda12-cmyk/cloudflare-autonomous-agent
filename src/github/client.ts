import { SecretRedactor } from '../security/secrets.js';
import {
  GitHubRepoMetadata,
  GitHubContentItem,
  GitHubFileResult,
  GitHubCommitItem,
  GitHubBranchItem,
  GitHubPullRequest,
  GitHubWorkflow,
  GitHubWorkflowRun,
  GitHubWorkflowJob,
  AuthorizedRepoMetadata,
} from './types.js';

export class GitHubApiError extends Error {
  public status: number;
  constructor(message: string, status: number = 500) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
  }
}

export class GitHubSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitHubSecurityError';
  }
}

function decodeBase64Utf8(b64: string): string {
  const cleaned = b64.replace(/\s+/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function encodeBase64Utf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export class GitHubService {
  private token: string;
  private owner: string = '';
  private repo: string = '';
  private authenticatedUser: string = '';
  private resolved: boolean = false;
  private redactor: SecretRedactor;
  private baseUrl = 'https://api.github.com';

  constructor(
    token?: string,
    redactorOrOwner?: SecretRedactor | string,
    repo?: string,
    redactor?: SecretRedactor
  ) {
    this.token = token?.trim() || '';
    if (typeof redactorOrOwner === 'object' && redactorOrOwner instanceof SecretRedactor) {
      this.redactor = redactorOrOwner;
    } else if (typeof redactorOrOwner === 'string' && repo) {
      this.owner = redactorOrOwner.trim();
      this.repo = repo.trim();
      this.resolved = !!(this.owner && this.repo);
      this.redactor = redactor || new SecretRedactor();
    } else {
      this.redactor = redactor || new SecretRedactor();
    }

    if (this.token) {
      this.redactor.addSecret(this.token);
    }
  }

  public isConfigured(): boolean {
    return !!this.token;
  }

  public getTargetRepository(): { owner: string; repo: string } {
    return { owner: this.owner, repo: this.repo };
  }

  public getAuthenticatedUser(): string {
    return this.authenticatedUser;
  }

  public hasResolvedRepository(): boolean {
    return this.resolved && !!(this.owner && this.repo);
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new GitHubApiError(
        'GitHub playground repository is not configured. Missing GITHUB_TOKEN.',
        400
      );
    }
  }

  /**
   * Discovers and locks the single authorized repository accessible to the fine-grained PAT.
   * Queries the GitHub API to list repositories accessible to the token.
   * Strictly enforces that exactly ONE repository is accessible; otherwise halts and rejects.
   */
  public async resolveAuthorizedRepository(): Promise<AuthorizedRepoMetadata> {
    this.ensureConfigured();

    if (this.resolved && this.owner && this.repo) {
      return {
        owner: this.owner,
        repo: this.repo,
        fullName: `${this.owner}/${this.repo}`,
      };
    }

    // 1. Check authenticated user identity (if /user endpoint is permitted for this token)
    try {
      const userRes = await this.rawRequest<any>('/user');
      if (userRes && typeof userRes.login === 'string') {
        this.authenticatedUser = userRes.login;
      }
    } catch {
      // Fine-grained PATs with repository-only scopes may not grant user profile read.
      // Identity will be derived from the authorized repository below.
    }

    // 2. Discover accessible repositories for the authenticated token
    let repos: any[] = [];
    try {
      const data = await this.rawRequest<any>(
        '/user/repos?per_page=100&affiliation=owner,collaborator,organization_member'
      );
      if (Array.isArray(data)) {
        repos = data;
      }
    } catch (err: any) {
      // Fallback: check installation repositories (if GitHub App / installation token)
      try {
        const installData = await this.rawRequest<any>('/installation/repositories?per_page=100');
        if (installData && Array.isArray(installData.repositories)) {
          repos = installData.repositories;
        }
      } catch {
        throw err;
      }
    }

    if (!Array.isArray(repos) || repos.length === 0) {
      throw new GitHubSecurityError(
        'No accessible repositories found for the provided GITHUB_TOKEN. Ensure the fine-grained PAT is granted repository access to the dedicated playground repository.'
      );
    }

    if (repos.length > 1) {
      const repoList = repos
        .map((r: any) => r.full_name || `${r.owner?.login}/${r.name}`)
        .join(', ');
      throw new GitHubSecurityError(
        `Security boundary violated: GITHUB_TOKEN has access to ${repos.length} repositories (${repoList}). For safe sandbox isolation, the fine-grained PAT must be restricted by GitHub to exactly ONE dedicated playground repository.`
      );
    }

    const authorized = repos[0];
    const repoOwner = authorized.owner?.login;
    const repoName = authorized.name;

    if (!repoOwner || !repoName) {
      throw new GitHubSecurityError(
        'Invalid repository metadata returned by GitHub API for the authorized token.'
      );
    }

    this.owner = repoOwner;
    this.repo = repoName;
    if (!this.authenticatedUser) {
      this.authenticatedUser = repoOwner;
    }
    this.resolved = true;

    return {
      owner: this.owner,
      repo: this.repo,
      fullName: `${this.owner}/${this.repo}`,
      defaultBranch: authorized.default_branch,
      isPrivate: authorized.private,
    };
  }

  public async ensureAuthorizedRepository(): Promise<{ owner: string; repo: string }> {
    this.ensureConfigured();
    if (!this.resolved || !this.owner || !this.repo) {
      await this.resolveAuthorizedRepository();
    }
    return { owner: this.owner, repo: this.repo };
  }

  public validateRepositoryAccess(targetOwner?: string, targetRepo?: string): void {
    if (!this.resolved || !this.owner || !this.repo) {
      return;
    }
    if (targetOwner && targetOwner.toLowerCase() !== this.owner.toLowerCase()) {
      throw new GitHubSecurityError(
        `Access denied: Target owner "${targetOwner}" does not match authorized repository owner "${this.owner}".`
      );
    }
    if (targetRepo && targetRepo.toLowerCase() !== this.repo.toLowerCase()) {
      throw new GitHubSecurityError(
        `Access denied: Target repository "${targetRepo}" does not match authorized playground repository "${this.repo}".`
      );
    }
  }

  private validatePath(path: string): string {
    if (/^https?:\/\//i.test(path) || path.includes('github.com/')) {
      throw new GitHubSecurityError(
        'Absolute URLs and external repositories are prohibited. Path must be relative to the playground repository root.'
      );
    }

    const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '');
    const parts = normalized.split('/');
    for (const part of parts) {
      if (part === '..' || part === '.') {
        throw new GitHubSecurityError(
          `Directory traversal is prohibited. Path "${path}" attempts directory escape.`
        );
      }
    }
    return normalized;
  }

  private async rawRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    this.ensureConfigured();

    const url = `${this.baseUrl}${endpoint}`;
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${this.token}`);
    headers.set('Accept', 'application/vnd.github+json');
    headers.set('X-GitHub-Api-Version', '2022-11-28');
    headers.set('User-Agent', 'CloudflareAutonomousAgent-Playground');

    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errText = await res.text();
      const sanitized = this.redactor.redact(errText);
      throw new GitHubApiError(
        `GitHub API error (HTTP ${res.status}): ${sanitized}`,
        res.status
      );
    }

    if (res.status === 204) {
      return {} as T;
    }

    return (await res.json()) as T;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    await this.ensureAuthorizedRepository();
    return this.rawRequest<T>(endpoint, options);
  }

  // ==========================================
  // Repository Inspection & Search
  // ==========================================

  public async getRepository(): Promise<GitHubRepoMetadata> {
    await this.ensureAuthorizedRepository();
    const data = await this.request<any>(
      `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}`
    );
    return {
      name: data.name,
      fullName: data.full_name,
      description: data.description || null,
      defaultBranch: data.default_branch,
      isPrivate: !!data.private,
      stars: data.stargazers_count || 0,
      forks: data.forks_count || 0,
      openIssuesCount: data.open_issues_count || 0,
      updatedAt: data.updated_at,
    };
  }

  public async getDefaultBranch(): Promise<string> {
    const repo = await this.getRepository();
    return repo.defaultBranch;
  }

  public async listContents(
    path: string = '',
    ref?: string
  ): Promise<GitHubContentItem[]> {
    await this.ensureAuthorizedRepository();
    const cleanPath = path ? this.validatePath(path) : '';
    let endpoint = `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(
      this.repo
    )}/contents/${encodeURIComponent(cleanPath)}`;
    if (ref) {
      endpoint += `?ref=${encodeURIComponent(ref)}`;
    }

    const data = await this.request<any>(endpoint);
    const items = Array.isArray(data) ? data : [data];
    return items.map((item) => ({
      name: item.name,
      path: item.path,
      sha: item.sha,
      size: item.size || 0,
      type: item.type as GitHubContentItem['type'],
    }));
  }

  public async getFile(
    path: string,
    ref?: string
  ): Promise<GitHubFileResult> {
    await this.ensureAuthorizedRepository();
    const cleanPath = this.validatePath(path);
    let endpoint = `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(
      this.repo
    )}/contents/${encodeURIComponent(cleanPath)}`;
    if (ref) {
      endpoint += `?ref=${encodeURIComponent(ref)}`;
    }

    const data = await this.request<any>(endpoint);
    if (data.type !== 'file') {
      throw new GitHubApiError(
        `Target path "${path}" is a ${data.type}, not a file.`,
        400
      );
    }

    let rawContent = '';
    if (data.content && data.encoding === 'base64') {
      rawContent = decodeBase64Utf8(data.content);
    } else if (typeof data.content === 'string') {
      rawContent = data.content;
    }

    const maxChars = 20000;
    const truncated = rawContent.length > maxChars;
    const content = truncated
      ? rawContent.slice(0, maxChars) +
        `\n\n... [TRUNCATED: File exceeds ${maxChars} characters]`
      : rawContent;

    return {
      name: data.name,
      path: data.path,
      sha: data.sha,
      size: data.size || 0,
      content,
      truncated,
    };
  }

  public async searchCode(
    query: string
  ): Promise<{ totalCount: number; items: Array<{ name: string; path: string; sha: string }> }> {
    await this.ensureAuthorizedRepository();

    // Security boundary: Prohibit model or prompt from searching external repositories
    const repoMatch = query.match(/repo:([^\s]+)/i);
    if (repoMatch) {
      const requestedRepo = repoMatch[1].toLowerCase();
      const authorizedRepo = `${this.owner}/${this.repo}`.toLowerCase();
      if (requestedRepo !== authorizedRepo) {
        throw new GitHubSecurityError(
          `Access denied: Code search is restricted to the authorized playground repository "${this.owner}/${this.repo}". Search across "${repoMatch[1]}" is prohibited.`
        );
      }
    }

    const sanitizedQuery = query.replace(/repo:[^\s]+/gi, '').trim();
    const scopedQuery = `${sanitizedQuery} repo:${this.owner}/${this.repo}`;
    const endpoint = `/search/code?q=${encodeURIComponent(scopedQuery)}`;
    const data = await this.request<any>(endpoint);

    const items = (data.items || []).slice(0, 10).map((item: any) => ({
      name: item.name,
      path: item.path,
      sha: item.sha,
    }));

    return {
      totalCount: data.total_count || 0,
      items,
    };
  }

  // ==========================================
  // File Modifications & Commits
  // ==========================================

  public async createOrUpdateFile(params: {
    path: string;
    content: string;
    message: string;
    branch?: string;
    sha?: string;
  }): Promise<{ success: boolean; path: string; commitSha: string; contentSha: string }> {
    await this.ensureAuthorizedRepository();
    const cleanPath = this.validatePath(params.path);
    const endpoint = `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(
      this.repo
    )}/contents/${encodeURIComponent(cleanPath)}`;

    // If sha is not provided, try to fetch current file sha if it exists
    let sha = params.sha;
    if (!sha) {
      try {
        const existing = await this.request<any>(
          `${endpoint}${params.branch ? `?ref=${encodeURIComponent(params.branch)}` : ''}`
        );
        if (existing && existing.sha) {
          sha = existing.sha;
        }
      } catch {
        // File does not exist yet, create new
      }
    }

    const body: Record<string, unknown> = {
      message: params.message,
      content: encodeBase64Utf8(params.content),
    };
    if (sha) {
      body.sha = sha;
    }
    if (params.branch) {
      body.branch = params.branch;
    }

    const data = await this.request<any>(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return {
      success: true,
      path: cleanPath,
      commitSha: data.commit?.sha || '',
      contentSha: data.content?.sha || '',
    };
  }

  public async deleteFile(params: {
    path: string;
    message: string;
    sha: string;
    branch?: string;
  }): Promise<{ success: boolean; path: string; commitSha: string }> {
    await this.ensureAuthorizedRepository();
    const cleanPath = this.validatePath(params.path);
    const endpoint = `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(
      this.repo
    )}/contents/${encodeURIComponent(cleanPath)}`;

    const body: Record<string, unknown> = {
      message: params.message,
      sha: params.sha,
    };
    if (params.branch) {
      body.branch = params.branch;
    }

    const data = await this.request<any>(endpoint, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return {
      success: true,
      path: cleanPath,
      commitSha: data.commit?.sha || '',
    };
  }

  public async listCommits(params?: {
    branch?: string;
    path?: string;
    limit?: number;
  }): Promise<GitHubCommitItem[]> {
    await this.ensureAuthorizedRepository();
    let endpoint = `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(
      this.repo
    )}/commits?per_page=${params?.limit || 10}`;
    if (params?.branch) {
      endpoint += `&sha=${encodeURIComponent(params.branch)}`;
    }
    if (params?.path) {
      endpoint += `&path=${encodeURIComponent(this.validatePath(params.path))}`;
    }

    const data = await this.request<any[]>(endpoint);
    return data.map((c) => ({
      sha: c.sha,
      message: c.commit?.message?.split('\n')[0] || '',
      author: c.commit?.author?.name || c.author?.login || 'Unknown',
      date: c.commit?.author?.date || '',
    }));
  }

  public async getCommit(ref: string): Promise<{
    sha: string;
    message: string;
    author: string;
    date: string;
    files: Array<{ filename: string; status: string; additions: number; deletions: number }>;
  }> {
    await this.ensureAuthorizedRepository();
    const endpoint = `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(
      this.repo
    )}/commits/${encodeURIComponent(ref)}`;
    const data = await this.request<any>(endpoint);

    return {
      sha: data.sha,
      message: data.commit?.message || '',
      author: data.commit?.author?.name || data.author?.login || 'Unknown',
      date: data.commit?.author?.date || '',
      files: (data.files || []).slice(0, 15).map((f: any) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
      })),
    };
  }

  public async listBranches(limit: number = 20): Promise<GitHubBranchItem[]> {
    await this.ensureAuthorizedRepository();
    const endpoint = `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(
      this.repo
    )}/branches?per_page=${limit}`;
    const data = await this.request<any[]>(endpoint);
    return data.map((b) => ({
      name: b.name,
      commitSha: b.commit?.sha || '',
      isProtected: !!b.protected,
    }));
  }

  public async createBranch(
    branchName: string,
    fromBranchOrSha?: string
  ): Promise<{ success: boolean; branch: string; sha: string }> {
    await this.ensureAuthorizedRepository();
    const cleanBranch = branchName.replace(/^refs\/heads\//, '').trim();
    if (!cleanBranch) {
      throw new GitHubApiError('Branch name must not be empty.', 400);
    }

    // Determine target base commit SHA
    let baseSha = fromBranchOrSha?.trim();
    if (!baseSha || !/^[0-9a-f]{40}$/i.test(baseSha)) {
      const baseBranch = baseSha || (await this.getDefaultBranch());
      const refData = await this.request<any>(
        `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(
          this.repo
        )}/git/ref/heads/${encodeURIComponent(baseBranch)}`
      );
      baseSha = refData.object?.sha;
      if (!baseSha) {
        throw new GitHubApiError(
          `Could not resolve base commit for branch "${baseBranch}".`,
          400
        );
      }
    }

    const endpoint = `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(
      this.repo
    )}/git/refs`;

    await this.request<any>(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref: `refs/heads/${cleanBranch}`,
        sha: baseSha,
      }),
    });

    return {
      success: true,
      branch: cleanBranch,
      sha: baseSha,
    };
  }

  // ==========================================
  // Pull Requests
  // ==========================================

  public async createPullRequest(params: {
    title: string;
    head: string;
    base: string;
    body?: string;
  }): Promise<GitHubPullRequest> {
    await this.ensureAuthorizedRepository();
    const endpoint = `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(
      this.repo
    )}/pulls`;

    const data = await this.request<any>(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: params.title,
        head: params.head,
        base: params.base,
        body: params.body || '',
      }),
    });

    return {
      number: data.number,
      title: data.title,
      state: data.state,
      htmlUrl: data.html_url,
      head: data.head?.ref || params.head,
      base: data.base?.ref || params.base,
      body: data.body,
      createdAt: data.created_at,
      merged: !!data.merged,
      mergeable: data.mergeable,
    };
  }

  public async getPullRequest(pullNumber: number): Promise<GitHubPullRequest> {
    await this.ensureAuthorizedRepository();
    const endpoint = `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(
      this.repo
    )}/pulls/${pullNumber}`;
    const data = await this.request<any>(endpoint);

    return {
      number: data.number,
      title: data.title,
      state: data.state,
      htmlUrl: data.html_url,
      head: data.head?.ref || '',
      base: data.base?.ref || '',
      body: data.body,
      createdAt: data.created_at,
      merged: !!data.merged,
      mergeable: data.mergeable,
    };
  }

  public async listPullRequests(params?: {
    state?: 'open' | 'closed' | 'all';
    limit?: number;
  }): Promise<GitHubPullRequest[]> {
    await this.ensureAuthorizedRepository();
    const state = params?.state || 'open';
    const limit = params?.limit || 10;
    const endpoint = `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(
      this.repo
    )}/pulls?state=${state}&per_page=${limit}`;

    const data = await this.request<any[]>(endpoint);
    return data.map((pr) => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      htmlUrl: pr.html_url,
      head: pr.head?.ref || '',
      base: pr.base?.ref || '',
      createdAt: pr.created_at,
      merged: !!pr.merged,
    }));
  }

  // ==========================================
  // GitHub Actions Workflows & Runs
  // ==========================================

  public async listWorkflows(): Promise<GitHubWorkflow[]> {
    await this.ensureAuthorizedRepository();
    const endpoint = `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(
      this.repo
    )}/actions/workflows`;
    const data = await this.request<any>(endpoint);
    const workflows = data.workflows || [];
    return workflows.map((wf: any) => ({
      id: wf.id,
      name: wf.name,
      path: wf.path,
      state: wf.state,
    }));
  }

  public async getWorkflow(
    workflowIdOrFileName: string | number
  ): Promise<GitHubWorkflow> {
    await this.ensureAuthorizedRepository();
    const endpoint = `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(
      this.repo
    )}/actions/workflows/${encodeURIComponent(String(workflowIdOrFileName))}`;
    const data = await this.request<any>(endpoint);
    return {
      id: data.id,
      name: data.name,
      path: data.path,
      state: data.state,
    };
  }

  public async triggerWorkflow(params: {
    workflowId: string | number;
    ref: string;
    inputs?: Record<string, unknown>;
  }): Promise<{ success: boolean; message: string; workflowId: string | number; ref: string }> {
    await this.ensureAuthorizedRepository();
    const endpoint = `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(
      this.repo
    )}/actions/workflows/${encodeURIComponent(String(params.workflowId))}/dispatches`;

    await this.request<any>(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref: params.ref,
        inputs: params.inputs || {},
      }),
    });

    return {
      success: true,
      message: `Workflow "${params.workflowId}" successfully dispatched on ref "${params.ref}".`,
      workflowId: params.workflowId,
      ref: params.ref,
    };
  }

  public async listWorkflowRuns(params?: {
    workflowId?: string | number;
    branch?: string;
    status?: string;
    limit?: number;
  }): Promise<GitHubWorkflowRun[]> {
    await this.ensureAuthorizedRepository();
    const limit = params?.limit || 10;
    let endpoint = params?.workflowId
      ? `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(
          this.repo
        )}/actions/workflows/${encodeURIComponent(String(params.workflowId))}/runs?per_page=${limit}`
      : `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(
          this.repo
        )}/actions/runs?per_page=${limit}`;

    if (params?.branch) {
      endpoint += `&branch=${encodeURIComponent(params.branch)}`;
    }
    if (params?.status) {
      endpoint += `&status=${encodeURIComponent(params.status)}`;
    }

    const data = await this.request<any>(endpoint);
    const runs = data.workflow_runs || [];
    return runs.map((run: any) => ({
      id: run.id,
      name: run.name,
      headBranch: run.head_branch || '',
      headSha: run.head_sha || '',
      status: run.status,
      conclusion: run.conclusion || null,
      event: run.event,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
      htmlUrl: run.html_url,
    }));
  }

  public async getWorkflowRun(runId: number): Promise<{
    run: GitHubWorkflowRun;
    jobs: GitHubWorkflowJob[];
  }> {
    await this.ensureAuthorizedRepository();
    const runEndpoint = `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(
      this.repo
    )}/actions/runs/${runId}`;
    const runData = await this.request<any>(runEndpoint);

    const jobsEndpoint = `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(
      this.repo
    )}/actions/runs/${runId}/jobs`;
    let jobs: GitHubWorkflowJob[] = [];
    try {
      const jobsData = await this.request<any>(jobsEndpoint);
      jobs = (jobsData.jobs || []).map((j: any) => ({
        id: j.id,
        name: j.name,
        status: j.status,
        conclusion: j.conclusion || null,
        steps: (j.steps || []).map((s: any) => ({
          name: s.name,
          status: s.status,
          conclusion: s.conclusion || null,
          number: s.number,
        })),
      }));
    } catch {
      // If jobs endpoint is not accessible or empty, return empty jobs
    }

    return {
      run: {
        id: runData.id,
        name: runData.name,
        headBranch: runData.head_branch || '',
        headSha: runData.head_sha || '',
        status: runData.status,
        conclusion: runData.conclusion || null,
        event: runData.event,
        createdAt: runData.created_at,
        updatedAt: runData.updated_at,
        htmlUrl: runData.html_url,
      },
      jobs,
    };
  }

  public async getWorkflowRunLogs(runId: number): Promise<{
    runId: number;
    summary: string;
    jobs: GitHubWorkflowJob[];
  }> {
    const { run, jobs } = await this.getWorkflowRun(runId);

    const failedSteps: string[] = [];
    for (const job of jobs) {
      if (job.conclusion === 'failure' || job.status === 'in_progress') {
        for (const step of job.steps || []) {
          if (step.conclusion === 'failure') {
            failedSteps.push(`Job "${job.name}" failed at step ${step.number}: "${step.name}"`);
          }
        }
      }
    }

    const summary = failedSteps.length > 0
      ? `Workflow Run ${runId} (${run.name}): ${run.status}/${run.conclusion}. Failures: ${failedSteps.join('; ')}`
      : `Workflow Run ${runId} (${run.name}): Status is ${run.status}, Conclusion is ${run.conclusion || 'pending'}. All steps passed or pending.`;

    return {
      runId,
      summary,
      jobs,
    };
  }
}
