export interface GitHubRepoMetadata {
  name: string;
  fullName: string;
  description: string | null;
  defaultBranch: string;
  isPrivate: boolean;
  stars: number;
  forks: number;
  openIssuesCount: number;
  updatedAt: string;
}

export interface GitHubContentItem {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir' | 'submodule' | 'symlink';
}

export interface GitHubFileResult {
  name: string;
  path: string;
  sha: string;
  size: number;
  content: string;
  truncated: boolean;
}

export interface GitHubCommitItem {
  sha: string;
  message: string;
  author: string;
  date: string;
}

export interface GitHubBranchItem {
  name: string;
  commitSha: string;
  isProtected: boolean;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  state: string;
  htmlUrl: string;
  head: string;
  base: string;
  body?: string | null;
  createdAt: string;
  merged?: boolean;
  mergeable?: boolean | null;
}

export interface GitHubWorkflow {
  id: number;
  name: string;
  path: string;
  state: string;
}

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  headBranch: string;
  headSha: string;
  status: string;
  conclusion: string | null;
  event: string;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
}

export interface GitHubWorkflowJobStep {
  name: string;
  status: string;
  conclusion: string | null;
  number: number;
}

export interface GitHubWorkflowJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  steps?: GitHubWorkflowJobStep[];
}

export interface AuthorizedRepoMetadata {
  owner: string;
  repo: string;
  fullName: string;
  defaultBranch?: string;
  isPrivate?: boolean;
}

