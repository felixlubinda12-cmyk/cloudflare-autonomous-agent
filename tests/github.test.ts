import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubService, GitHubSecurityError, GitHubApiError } from '../src/github/client.js';
import { ToolRegistry } from '../src/tools/registry.js';
import { ToolExecutionContext } from '../src/tools/types.js';
import { SecretRedactor } from '../src/security/secrets.js';

describe('GitHub Playground Integration Suite', () => {
  const token = 'ghp_PlaygroundToken1234567890abcdef1234567890';
  const owner = 'test-org';
  const repo = 'test-playground-repo';

  let github: GitHubService;

  beforeEach(() => {
    vi.restoreAllMocks();
    github = new GitHubService(token, owner, repo);
  });

  it('correctly identifies configured state and target repository', () => {
    expect(github.isConfigured()).toBe(true);
    expect(github.getTargetRepository()).toEqual({ owner: 'test-org', repo: 'test-playground-repo' });

    const unconfigured = new GitHubService();
    expect(unconfigured.isConfigured()).toBe(false);
  });

  it('inspects repository metadata (github_get_repository)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        name: 'test-playground-repo',
        full_name: 'test-org/test-playground-repo',
        description: 'Dedicated agent playground',
        default_branch: 'main',
        private: true,
        stargazers_count: 5,
        forks_count: 2,
        open_issues_count: 0,
        updated_at: '2026-09-04T12:00:00Z',
      }),
    }));

    const data = await github.getRepository();
    expect(data.name).toBe('test-playground-repo');
    expect(data.defaultBranch).toBe('main');
    expect(data.isPrivate).toBe(true);
  });

  it('lists repository directory contents (github_list_contents)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        { name: 'src', path: 'src', sha: 'sha1', size: 0, type: 'dir' },
        { name: 'README.md', path: 'README.md', sha: 'sha2', size: 120, type: 'file' },
      ],
    }));

    const contents = await github.listContents('src');
    expect(contents.length).toBe(2);
    expect(contents[0].name).toBe('src');
    expect(contents[0].type).toBe('dir');
    expect(contents[1].name).toBe('README.md');
    expect(contents[1].type).toBe('file');
  });

  it('reads and decodes UTF-8 base64 file content (github_get_file)', async () => {
    const rawText = 'console.log("Hello from GitHub Playground!");';
    const b64 = btoa(rawText);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        name: 'index.js',
        path: 'src/index.js',
        sha: 'file-sha-123',
        size: rawText.length,
        type: 'file',
        encoding: 'base64',
        content: b64,
      }),
    }));

    const file = await github.getFile('src/index.js');
    expect(file.content).toBe(rawText);
    expect(file.truncated).toBe(false);
  });

  it('safely truncates exceptionally large files', async () => {
    const largeText = 'A'.repeat(25000);
    const b64 = btoa(largeText);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        name: 'large.txt',
        path: 'large.txt',
        sha: 'file-sha-large',
        size: largeText.length,
        type: 'file',
        encoding: 'base64',
        content: b64,
      }),
    }));

    const file = await github.getFile('large.txt');
    expect(file.truncated).toBe(true);
    expect(file.content).toContain('TRUNCATED');
  });

  it('searches code strictly scoped to the playground repository (github_search_code)', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      expect(url).toContain(encodeURIComponent('export default repo:test-org/test-playground-repo'));
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          total_count: 1,
          items: [{ name: 'index.ts', path: 'src/index.ts', sha: 'search-sha' }],
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const search = await github.searchCode('export default');
    expect(search.totalCount).toBe(1);
    expect(search.items[0].path).toBe('src/index.ts');
  });

  it('creates or updates a file with base64 encoding (github_create_or_update_file)', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, options: any) => {
      if (options?.method === 'PUT') {
        const body = JSON.parse(options.body);
        expect(body.message).toBe('Add new test file');
        expect(atob(body.content)).toBe('const x = 42;');
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            commit: { sha: 'new-commit-sha' },
            content: { sha: 'new-content-sha' },
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, text: async () => 'Not found' });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await github.createOrUpdateFile({
      path: 'src/config.js',
      content: 'const x = 42;',
      message: 'Add new test file',
    });

    expect(res.success).toBe(true);
    expect(res.commitSha).toBe('new-commit-sha');
  });

  it('deletes a file with commit (github_delete_file)', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, options: any) => {
      expect(options.method).toBe('DELETE');
      const body = JSON.parse(options.body);
      expect(body.sha).toBe('old-file-sha');
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          commit: { sha: 'delete-commit-sha' },
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await github.deleteFile({
      path: 'deprecated.js',
      message: 'Remove deprecated script',
      sha: 'old-file-sha',
    });

    expect(res.success).toBe(true);
    expect(res.commitSha).toBe('delete-commit-sha');
  });

  it('lists branches and creates a branch from default branch (github_create_branch)', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, options: any) => {
      if (url.includes('/git/ref/heads/main')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ object: { sha: 'main-tip-sha' } }),
        });
      }
      if (options?.method === 'POST' && url.includes('/git/refs')) {
        const body = JSON.parse(options.body);
        expect(body.ref).toBe('refs/heads/feature/test-branch');
        expect(body.sha).toBe('main-tip-sha');
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({}),
        });
      }
      if (url.includes('/repos/test-org/test-playground-repo')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ default_branch: 'main' }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await github.createBranch('feature/test-branch');
    expect(res.success).toBe(true);
    expect(res.branch).toBe('feature/test-branch');
    expect(res.sha).toBe('main-tip-sha');
  });

  it('creates and inspects pull requests (github_create_pull_request, github_get_pull_request)', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, options: any) => {
      if (options?.method === 'POST' && url.endsWith('/pulls')) {
        const body = JSON.parse(options.body);
        expect(body.title).toBe('Add new playground feature');
        expect(body.head).toBe('feature/test');
        expect(body.base).toBe('main');
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            number: 12,
            title: body.title,
            state: 'open',
            html_url: 'https://github.com/test-org/test-playground-repo/pull/12',
            head: { ref: 'feature/test' },
            base: { ref: 'main' },
            body: 'Pull request body description',
            created_at: '2026-09-04T14:00:00Z',
            merged: false,
          }),
        });
      }
      if (url.endsWith('/pulls/12')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            number: 12,
            title: 'Add new playground feature',
            state: 'open',
            html_url: 'https://github.com/test-org/test-playground-repo/pull/12',
            head: { ref: 'feature/test' },
            base: { ref: 'main' },
            body: 'Pull request body description',
            created_at: '2026-09-04T14:00:00Z',
            merged: false,
            mergeable: true,
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    const pr = await github.createPullRequest({
      title: 'Add new playground feature',
      head: 'feature/test',
      base: 'main',
      body: 'Pull request body description',
    });
    expect(pr.number).toBe(12);

    const inspectPr = await github.getPullRequest(12);
    expect(inspectPr.number).toBe(12);
    expect(inspectPr.mergeable).toBe(true);
  });

  it('triggers GitHub Actions workflow dispatch and parses run logs / failure points', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, options: any) => {
      if (options?.method === 'POST' && url.includes('/dispatches')) {
        const body = JSON.parse(options.body);
        expect(body.ref).toBe('main');
        return Promise.resolve({
          ok: true,
          status: 204,
          text: async () => '',
        });
      }
      if (url.includes('/actions/runs/98765/jobs')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            jobs: [
              {
                id: 1,
                name: 'build-and-test',
                status: 'completed',
                conclusion: 'failure',
                steps: [
                  { name: 'Checkout code', status: 'completed', conclusion: 'success', number: 1 },
                  { name: 'Run test suite', status: 'completed', conclusion: 'failure', number: 2 },
                ],
              },
            ],
          }),
        });
      }
      if (url.includes('/actions/runs/98765')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            id: 98765,
            name: 'CI Workflow',
            head_branch: 'main',
            status: 'completed',
            conclusion: 'failure',
            event: 'workflow_dispatch',
            created_at: '2026-09-04T15:00:00Z',
            updated_at: '2026-09-04T15:02:00Z',
            html_url: 'https://github.com/test-org/test-playground-repo/actions/runs/98765',
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    // 1. Dispatch
    const dispatchRes = await github.triggerWorkflow({
      workflowId: 'ci.yml',
      ref: 'main',
    });
    expect(dispatchRes.success).toBe(true);

    // 2. Log summary
    const logRes = await github.getWorkflowRunLogs(98765);
    expect(logRes.runId).toBe(98765);
    expect(logRes.summary).toContain('Job "build-and-test" failed at step 2: "Run test suite"');
  });

  it('rejects directory traversal attacks on file paths', async () => {
    await expect(github.getFile('../../etc/passwd')).rejects.toThrow(GitHubSecurityError);
    await expect(github.getFile('src/../../secrets.env')).rejects.toThrow(GitHubSecurityError);
    await expect(github.listContents('../')).rejects.toThrow(GitHubSecurityError);
  });

  it('redacts GitHub tokens from error messages and logs', () => {
    const redactor = new SecretRedactor([token]);
    const errorWithToken = `Request failed: Authorization: Bearer ${token} or ghp_PlaygroundToken1234567890abcdef1234567890`;
    const redacted = redactor.redact(errorWithToken);

    expect(redacted).not.toContain(token);
    expect(redacted).toContain('[REDACTED_SECRET]');
  });

  it('executes tools via ToolRegistry with execution context', async () => {
    const registry = new ToolRegistry();
    const fakeContext = {
      github,
      sessionId: 'session-123',
    } as unknown as ToolExecutionContext;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        name: 'test-playground-repo',
        full_name: 'test-org/test-playground-repo',
        description: 'Mock',
        default_branch: 'main',
        private: true,
        stargazers_count: 1,
        forks_count: 0,
        open_issues_count: 0,
        updated_at: '2026-09-04T00:00:00Z',
      }),
    }));

    const result = await registry.execute('github_get_repository', {}, fakeContext);
    expect(result.success).toBe(true);
    expect((result.data as any).name).toBe('test-playground-repo');
  });

  it('returns clean error when GitHub tool is executed without configuration', async () => {
    const registry = new ToolRegistry();
    const unconfiguredContext = {
      github: new GitHubService(), // not configured
      sessionId: 'session-123',
    } as unknown as ToolExecutionContext;

    const result = await registry.execute('github_get_repository', {}, unconfiguredContext);
    expect(result.success).toBe(false);
    expect(result.error).toContain('GitHub playground repository is not configured');
  });
});
