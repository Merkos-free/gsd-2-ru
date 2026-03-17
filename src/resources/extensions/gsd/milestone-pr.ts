/**
 * Milestone PR — orchestrates draft PR creation after milestone branch push.
 *
 * Creates a draft pull request from the milestone branch to the integration
 * branch with the milestone summary as the PR body. Also fetches CI check
 * status via `gh pr checks` when the CLI is available.
 *
 * All external calls are wrapped in try/catch with specific degradation
 * messages — missing auth or CLI tools warn and skip, never crash.
 */

import { execFileSync } from "node:child_process";
import {
  createGitHubClient,
  createPullRequest,
  getRepoInfo,
  truncatePRBody,
} from "./github-client.js";
import type { PullRequestResult } from "./github-client.js";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface MilestonePRResult {
  number: number;
  url: string;
}

export interface CICheckResult {
  name: string;
  status: string;
  conclusion: string;
}

export interface MilestonePROptions {
  basePath: string;
  milestoneId: string;
  milestoneTitle?: string;
  summaryContent: string;
  milestoneBranch: string;
  integrationBranch: string;
}

// ─── Draft PR Creation ─────────────────────────────────────────────────────

/**
 * Create a draft PR for a completed milestone.
 *
 * Calls getRepoInfo() → createGitHubClient() → createPullRequest() with
 * draft: true. Returns { number, url } on success, null on any failure.
 *
 * Degradation:
 * - No GITHUB_TOKEN → logs warning, returns null
 * - getRepoInfo fails → logs warning, returns null
 * - Octokit error → surfaces error message, returns null
 */
export async function createMilestonePR(
  options: MilestonePROptions,
): Promise<{ result: MilestonePRResult | null; warning: string | null }> {
  const { basePath, milestoneId, milestoneTitle, summaryContent, milestoneBranch, integrationBranch } = options;

  // Get repo info
  let repoInfo;
  try {
    repoInfo = await getRepoInfo(basePath);
  } catch (err) {
    const msg = `Failed to detect GitHub repository: ${err instanceof Error ? err.message : String(err)}`;
    return { result: null, warning: msg };
  }
  if (!repoInfo) {
    return { result: null, warning: "Could not detect GitHub owner/repo from git remote — skipping PR creation." };
  }

  // Create authenticated client
  const client = createGitHubClient();
  if (!client) {
    return {
      result: null,
      warning: "GitHub token not found — skipping PR creation. Set GITHUB_TOKEN or run `gh auth login`.",
    };
  }

  // Build PR content
  const title = milestoneTitle
    ? `feat(${milestoneId}): ${milestoneTitle}`
    : `feat(${milestoneId}): milestone completion`;
  const body = truncatePRBody(summaryContent);

  // Create draft PR
  let prResult: PullRequestResult;
  try {
    prResult = await createPullRequest(client, {
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      title,
      body,
      head: milestoneBranch,
      base: integrationBranch,
      draft: true,
    });
  } catch (err) {
    const msg = `Failed to create draft PR: ${err instanceof Error ? err.message : String(err)}`;
    return { result: null, warning: msg };
  }

  return {
    result: { number: prResult.number, url: prResult.url },
    warning: null,
  };
}

// ─── CI Check Status ───────────────────────────────────────────────────────

/**
 * Fetch CI check status for a PR using `gh pr checks`.
 * Returns parsed check results or null if `gh` is not available or fails.
 *
 * Degradation:
 * - `gh` not installed → returns { checks: null, warning }
 * - `gh pr checks` fails → returns { checks: null, warning }
 */
export function fetchCICheckStatus(
  prNumber: number,
  owner: string,
  repo: string,
): { checks: CICheckResult[] | null; warning: string | null } {
  try {
    const output = execFileSync(
      "gh",
      ["pr", "checks", String(prNumber), "--repo", `${owner}/${repo}`, "--json", "name,status,conclusion"],
      {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 30_000,
      },
    );
    const checks: CICheckResult[] = JSON.parse(output.trim());
    return { checks, warning: null };
  } catch (err) {
    // Distinguish between gh not found and other failures
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("ENOENT") || message.includes("not found") || message.includes("command not found")) {
      return { checks: null, warning: "gh CLI not installed — skipping CI check status." };
    }
    return { checks: null, warning: `Failed to fetch CI check status: ${message}` };
  }
}

/**
 * Format CI check results into a human-readable summary string.
 */
export function formatCICheckSummary(checks: CICheckResult[]): string {
  if (checks.length === 0) return "No CI checks found.";
  const lines = checks.map(c => {
    const status = c.conclusion || c.status || "unknown";
    const icon = status === "success" ? "✓" : status === "failure" ? "✗" : "●";
    return `  ${icon} ${c.name}: ${status}`;
  });
  return `CI checks (${checks.length}):\n${lines.join("\n")}`;
}
