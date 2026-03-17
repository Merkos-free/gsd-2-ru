/**
 * GSD GitHub Client
 *
 * Standalone utility for interacting with GitHub's API via Octokit.
 * Provides helpers for PR creation, review reading, and issue management.
 * Can be used by other extensions that need GitHub integration.
 */

import { execSync } from "node:child_process";
import { Octokit } from "@octokit/rest";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface RepoInfo {
  owner: string;
  repo: string;
}

export interface PullRequestOptions {
  owner: string;
  repo: string;
  title: string;
  body: string;
  head: string;
  base: string;
  draft?: boolean;
}

export interface PullRequestResult {
  number: number;
  url: string;
}

export interface PR {
  number: number;
  title: string;
  body: string | null;
  state: string;
  head: { ref: string; sha: string };
  base: { ref: string };
  url: string;
  user: { login: string } | null;
}

export interface Review {
  id: number;
  user: { login: string } | null;
  state: string;
  body: string | null;
  submitted_at: string | null;
}

export interface IssueCommentOptions {
  owner: string;
  repo: string;
  number: number;
  body: string;
}

// ─── Remote URL Parsing ────────────────────────────────────────────────────

/**
 * Parse a GitHub owner/repo from a git remote URL.
 * Supports both HTTPS and SSH formats:
 *   https://github.com/owner/repo.git
 *   git@github.com:owner/repo.git
 *   https://github.com/owner/repo
 *   ssh://git@github.com/owner/repo.git
 */
export function parseRemoteUrl(url: string): RepoInfo | null {
  // SSH format: git@github.com:owner/repo.git
  const sshMatch = url.match(/^git@github\.com:([^/]+)\/([^/.]+?)(?:\.git)?$/);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  // HTTPS or ssh:// format
  const httpsMatch = url.match(
    /(?:https?|ssh):\/\/(?:[^@]+@)?github\.com\/([^/]+)\/([^/.]+?)(?:\.git)?$/,
  );
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }

  return null;
}

// ─── Client Creation ───────────────────────────────────────────────────────

/**
 * Create an authenticated Octokit client.
 * Uses the provided token, or falls back to GITHUB_TOKEN / GH_TOKEN env vars.
 * Returns null if no token is available.
 */
export function createGitHubClient(token?: string): Octokit | null {
  const auth = token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!auth) {
    return null;
  }
  return new Octokit({ auth });
}

// ─── Repository Info ───────────────────────────────────────────────────────

/**
 * Detect the GitHub owner/repo from the git remote in the given working directory.
 */
export async function getRepoInfo(cwd: string): Promise<RepoInfo | null> {
  try {
    const url = execSync("git config --get remote.origin.url", {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();

    if (!url) return null;
    return parseRemoteUrl(url);
  } catch {
    return null;
  }
}

// ─── Pull Request Operations ───────────────────────────────────────────────

/** Maximum GitHub PR body length. GitHub's limit is 65,536 chars; we truncate at 65,000 with an ellipsis marker to leave margin. */
const PR_BODY_MAX_LENGTH = 65_000;
const PR_BODY_TRUNCATION_MARKER = "\n\n---\n*[body truncated — full content exceeds GitHub's limit]*";

/**
 * Truncate a PR body string to fit within GitHub's size limit.
 * If the body exceeds PR_BODY_MAX_LENGTH, it is cut and an ellipsis marker is appended.
 * Exported for testing and reuse by orchestration code.
 */
export function truncatePRBody(body: string): string {
  if (body.length <= PR_BODY_MAX_LENGTH) return body;
  return body.slice(0, PR_BODY_MAX_LENGTH) + PR_BODY_TRUNCATION_MARKER;
}

/**
 * Create a pull request on GitHub.
 */
export async function createPullRequest(
  client: Octokit,
  options: PullRequestOptions,
): Promise<PullRequestResult> {
  try {
    const { data } = await client.pulls.create({
      owner: options.owner,
      repo: options.repo,
      title: options.title,
      body: options.body,
      head: options.head,
      base: options.base,
      draft: options.draft,
    });
    return { number: data.number, url: data.html_url };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    throw new Error(
      `Failed to create pull request for ${options.owner}/${options.repo}: ${message}`,
    );
  }
}

/**
 * Fetch a single pull request by number.
 */
export async function getPullRequest(
  client: Octokit,
  options: { owner: string; repo: string; number: number },
): Promise<PR> {
  try {
    const { data } = await client.pulls.get({
      owner: options.owner,
      repo: options.repo,
      pull_number: options.number,
    });
    return {
      number: data.number,
      title: data.title,
      body: data.body,
      state: data.state,
      head: { ref: data.head.ref, sha: data.head.sha },
      base: { ref: data.base.ref },
      url: data.html_url,
      user: data.user ? { login: data.user.login } : null,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    throw new Error(
      `Failed to get pull request #${options.number} for ${options.owner}/${options.repo}: ${message}`,
    );
  }
}

/**
 * List reviews on a pull request.
 */
export async function listPullRequestReviews(
  client: Octokit,
  options: { owner: string; repo: string; number: number },
): Promise<Review[]> {
  try {
    const { data } = await client.pulls.listReviews({
      owner: options.owner,
      repo: options.repo,
      pull_number: options.number,
    });
    return data.map((review) => ({
      id: review.id,
      user: review.user ? { login: review.user.login } : null,
      state: review.state,
      body: review.body,
      submitted_at: review.submitted_at ?? null,
    }));
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    throw new Error(
      `Failed to list reviews for PR #${options.number} in ${options.owner}/${options.repo}: ${message}`,
    );
  }
}

// ─── Issue Comments ────────────────────────────────────────────────────────

/**
 * Create a comment on an issue or pull request.
 */
export async function createIssueComment(
  client: Octokit,
  options: IssueCommentOptions,
): Promise<{ id: number }> {
  try {
    const { data } = await client.issues.createComment({
      owner: options.owner,
      repo: options.repo,
      issue_number: options.number,
      body: options.body,
    });
    return { id: data.id };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    throw new Error(
      `Failed to create comment on issue #${options.number} in ${options.owner}/${options.repo}: ${message}`,
    );
  }
}
