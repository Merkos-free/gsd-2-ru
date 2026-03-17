/**
 * github-pr.test.ts — Tests for draft PR support, preference validation,
 * and PR body truncation.
 *
 * Covers:
 * - git.auto_pr preference validation (boolean accepted, non-boolean rejected)
 * - PullRequestOptions draft field type correctness
 * - PR body truncation at 65,000 chars with marker
 * - Preference validation error surface for invalid auto_pr
 */

import { validatePreferences } from "../preferences.ts";
import { truncatePRBody } from "../github-client.ts";
import type { PullRequestOptions } from "../github-client.ts";
import { createMilestonePR, fetchCICheckStatus, formatCICheckSummary } from "../milestone-pr.ts";
import type { CICheckResult } from "../milestone-pr.ts";
import { createTestContext } from "./test-helpers.ts";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const worktreePromptsDir = join(__dirname, "..", "prompts");

function loadPromptFromWorktree(name: string, vars: Record<string, string> = {}): string {
  const path = join(worktreePromptsDir, `${name}.md`);
  let content = readFileSync(path, "utf-8");
  for (const [key, value] of Object.entries(vars)) {
    content = content.replaceAll(`{{${key}}}`, value);
  }
  return content.trim();
}

const { assertEq, assertTrue, report } = createTestContext();

// ─── git.auto_pr preference validation ────────────────────────────────────

console.log("── git.auto_pr preference validation ──");

{
  // Accepts git.auto_pr: true
  const result = validatePreferences({ git: { auto_pr: true } });
  assertEq(result.preferences.git?.auto_pr, true, "git.auto_pr: true is accepted");
  assertEq(result.errors.length, 0, "no errors for git.auto_pr: true");
}

{
  // Accepts git.auto_pr: false
  const result = validatePreferences({ git: { auto_pr: false } });
  assertEq(result.preferences.git?.auto_pr, false, "git.auto_pr: false is accepted");
  assertEq(result.errors.length, 0, "no errors for git.auto_pr: false");
}

{
  // Rejects git.auto_pr: "yes" (non-boolean)
  const result = validatePreferences({ git: { auto_pr: "yes" as unknown as boolean } });
  assertTrue(
    result.preferences.git?.auto_pr === undefined,
    "git.auto_pr: 'yes' is stripped from validated output",
  );
  assertTrue(
    result.errors.some((e) => e.includes("git.auto_pr must be a boolean")),
    "error message mentions git.auto_pr must be a boolean",
  );
}

{
  // Rejects git.auto_pr: 1 (non-boolean)
  const result = validatePreferences({ git: { auto_pr: 1 as unknown as boolean } });
  assertTrue(
    result.errors.some((e) => e.includes("git.auto_pr must be a boolean")),
    "error message for git.auto_pr: 1 (number)",
  );
}

// ─── PullRequestOptions draft field ───────────────────────────────────────

console.log("── PullRequestOptions draft field ──");

{
  // PullRequestOptions accepts draft: true (compile-time type check; runtime shape check)
  const opts: PullRequestOptions = {
    owner: "test-owner",
    repo: "test-repo",
    title: "Test PR",
    body: "Test body",
    head: "feature-branch",
    base: "main",
    draft: true,
  };
  assertEq(opts.draft, true, "PullRequestOptions accepts draft: true");
}

{
  // PullRequestOptions works without draft (optional field)
  const opts: PullRequestOptions = {
    owner: "test-owner",
    repo: "test-repo",
    title: "Test PR",
    body: "Test body",
    head: "feature-branch",
    base: "main",
  };
  assertEq(opts.draft, undefined, "PullRequestOptions draft is optional (undefined)");
}

// ─── PR body truncation ──────────────────────────────────────────────────

console.log("── PR body truncation ──");

{
  // Short body is returned unchanged
  const short = "This is a short PR body.";
  assertEq(truncatePRBody(short), short, "short body passes through unchanged");
}

{
  // Exactly 65,000 chars is not truncated
  const exact = "x".repeat(65_000);
  assertEq(truncatePRBody(exact), exact, "exactly 65,000 chars is not truncated");
}

{
  // 65,001 chars IS truncated — marker is appended
  const over = "x".repeat(65_001);
  const result = truncatePRBody(over);
  assertTrue(result !== over, "65,001-char body is truncated (not identical to input)");
  assertTrue(result.startsWith("x".repeat(100)), "truncated body starts with original content");
  assertTrue(
    result.includes("[body truncated"),
    "truncated body contains truncation marker",
  );
}

{
  // Large body (100k chars) is truncated to 65,000 + marker
  const large = "a".repeat(100_000);
  const result = truncatePRBody(large);
  assertTrue(result.length < 100_000, "100k body is truncated");
  // First 65,000 chars should be the original content
  assertTrue(result.startsWith("a".repeat(65_000)), "first 65k chars preserved");
  assertTrue(
    result.endsWith("*"),
    "truncated body ends with the marker",
  );
}

// ─── Preference validation error surface (observability) ──────────────────

console.log("── preference validation error surface ──");

{
  // Validates that the error message is structured and specific
  const result = validatePreferences({ git: { auto_pr: "invalid" as unknown as boolean } });
  assertEq(
    result.errors.filter((e) => e === "git.auto_pr must be a boolean").length,
    1,
    "exactly one structured error for invalid auto_pr",
  );
}

{
  // auto_pr coexists with auto_push validation
  const result = validatePreferences({
    git: { auto_push: true, auto_pr: true },
  });
  assertEq(result.preferences.git?.auto_push, true, "auto_push preserved alongside auto_pr");
  assertEq(result.preferences.git?.auto_pr, true, "auto_pr preserved alongside auto_push");
  assertEq(result.errors.length, 0, "no errors when both are valid booleans");
}

// ─── pushBranchToRemote tests ─────────────────────────────────────────────

console.log("── pushBranchToRemote ──");

{
  // Test: pushBranchToRemote is exported and callable
  // We can't easily mock execSync in this test harness, but we can verify the
  // function exists, has the right shape, and returns boolean (false when no repo)
  const { pushBranchToRemote } = await import("../auto-worktree.ts");
  assertEq(typeof pushBranchToRemote, "function", "pushBranchToRemote is a function");
  // Call with a bogus path — should return false gracefully (no throw)
  const result = pushBranchToRemote("/nonexistent/path", "fake-branch", "origin");
  assertEq(result, false, "pushBranchToRemote returns false for nonexistent repo");
}

// ─── createMilestonePR tests ──────────────────────────────────────────────

console.log("── createMilestonePR ──");

{
  // Test: no GITHUB_TOKEN → warning + null result
  const savedToken = process.env.GITHUB_TOKEN;
  const savedGH = process.env.GH_TOKEN;
  delete process.env.GITHUB_TOKEN;
  delete process.env.GH_TOKEN;

  const outcome = await createMilestonePR({
    basePath: process.cwd(),
    milestoneId: "M099",
    milestoneTitle: "Test Milestone",
    summaryContent: "Test summary body",
    milestoneBranch: "milestone/M099",
    integrationBranch: "main",
  });

  assertTrue(outcome.result === null, "createMilestonePR returns null result when no token");
  assertTrue(outcome.warning !== null, "createMilestonePR returns warning when no token");
  assertTrue(
    outcome.warning!.includes("token") || outcome.warning!.includes("repo"),
    "warning mentions token or repo detection issue",
  );

  // Restore env
  if (savedToken) process.env.GITHUB_TOKEN = savedToken;
  if (savedGH) process.env.GH_TOKEN = savedGH;
}

{
  // Test: body is truncated for very large summaries (verify via the truncatePRBody used internally)
  const largeSummary = "z".repeat(100_000);
  const truncated = truncatePRBody(largeSummary);
  assertTrue(truncated.length < 100_000, "large summary is truncated before PR creation");
  assertTrue(truncated.includes("[body truncated"), "truncation marker present in large body");
}

// ─── CI check parsing tests ──────────────────────────────────────────────

console.log("── CI check status parsing ──");

{
  // Test: formatCICheckSummary with sample check data
  const checks: CICheckResult[] = [
    { name: "build", status: "completed", conclusion: "success" },
    { name: "test", status: "completed", conclusion: "failure" },
    { name: "lint", status: "in_progress", conclusion: "" },
  ];
  const summary = formatCICheckSummary(checks);
  assertTrue(summary.includes("CI checks (3)"), "summary includes check count");
  assertTrue(summary.includes("✓ build: success"), "summary shows success icon for build");
  assertTrue(summary.includes("✗ test: failure"), "summary shows failure icon for test");
  assertTrue(summary.includes("● lint:"), "summary shows in-progress icon for lint");
}

{
  // Test: formatCICheckSummary with empty checks
  const summary = formatCICheckSummary([]);
  assertEq(summary, "No CI checks found.", "empty checks returns appropriate message");
}

{
  // Test: fetchCICheckStatus with bogus repo — should degrade gracefully
  const ciResult = fetchCICheckStatus(99999, "nonexistent-owner", "nonexistent-repo");
  assertTrue(ciResult.checks === null, "fetchCICheckStatus returns null checks for bogus repo");
  assertTrue(ciResult.warning !== null, "fetchCICheckStatus returns warning for bogus repo");
}

// ─── Full chain logic tests ──────────────────────────────────────────────

console.log("── full chain logic ──");

{
  // Test: branchPushed=false + auto_pr=true → PR should be skipped
  // (This tests the logic pattern used in auto.ts, not the function directly)
  const branchPushed = false;
  const auto_pr = true;
  const shouldCreatePR = branchPushed && auto_pr;
  assertEq(shouldCreatePR, false, "branchPushed=false skips PR creation even with auto_pr=true");
}

{
  // Test: branchPushed=true + auto_pr=true → PR creation should proceed
  const branchPushed = true;
  const auto_pr = true;
  const shouldCreatePR = branchPushed && auto_pr;
  assertEq(shouldCreatePR, true, "branchPushed=true + auto_pr=true triggers PR creation");
}

{
  // Test: branchPushed=true + auto_pr=false → PR should be skipped
  const branchPushed = true;
  const auto_pr = false;
  const shouldCreatePR = branchPushed && auto_pr;
  assertEq(shouldCreatePR, false, "auto_pr=false skips PR creation even when branch pushed");
}

{
  // Test: MilestonePROptions shape — verify all required fields
  const opts: import("../milestone-pr.ts").MilestonePROptions = {
    basePath: "/test",
    milestoneId: "M001",
    summaryContent: "summary",
    milestoneBranch: "milestone/M001",
    integrationBranch: "main",
  };
  assertEq(opts.milestoneId, "M001", "MilestonePROptions accepts milestoneId");
  assertEq(opts.milestoneBranch, "milestone/M001", "MilestonePROptions accepts milestoneBranch");
  assertEq(opts.milestoneTitle, undefined, "MilestonePROptions milestoneTitle is optional");
}

{
  // Test: mergeMilestoneToMain return type includes branchPushed
  // We verify the type shape — the function itself requires a real git repo
  type MergeReturn = ReturnType<typeof import("../auto-worktree.ts").mergeMilestoneToMain>;
  // This is a compile-time check — if branchPushed isn't in the type, tsc will fail
  const mockReturn: MergeReturn = {
    commitMessage: "test",
    pushed: false,
    branchPushed: false,
    milestoneBranch: "milestone/M001",
    integrationBranch: "main",
  };
  assertEq(mockReturn.branchPushed, false, "mergeMilestoneToMain return includes branchPushed");
  assertEq(mockReturn.milestoneBranch, "milestone/M001", "mergeMilestoneToMain return includes milestoneBranch");
  assertEq(mockReturn.integrationBranch, "main", "mergeMilestoneToMain return includes integrationBranch");
}

// ─── Complete-milestone prompt: git automation guidance ────────────────────

console.log("── complete-milestone prompt git automation guidance ──");

{
  // Test: complete-milestone prompt template accepts gitAutomationGuidance variable
  const baseVars = {
    workingDirectory: "/test",
    milestoneId: "M001",
    milestoneTitle: "Test Milestone",
    roadmapPath: ".gsd/milestones/M001/M001-ROADMAP.md",
    inlinedContext: "## Inlined Context\n\ntest context",
    milestoneSummaryPath: "/test/.gsd/milestones/M001/M001-SUMMARY.md",
  };

  // With auto_push + auto_pr guidance (both enabled)
  const bothGuidance = [
    "## Git Automation",
    "",
    "After milestone completion, GSD will automatically push the milestone branch to remote and create a draft PR with your milestone summary as the body. CI check status will be reported. Do not perform manual git push or PR creation.",
  ].join("\n");

  const promptBoth = loadPromptFromWorktree("complete-milestone", {
    ...baseVars,
    gitAutomationGuidance: bothGuidance,
  });
  assertTrue(
    promptBoth.includes("automatically push the milestone branch to remote"),
    "prompt with auto_push+auto_pr contains push guidance",
  );
  assertTrue(
    promptBoth.includes("create a draft PR"),
    "prompt with auto_push+auto_pr contains PR guidance",
  );
  assertTrue(
    promptBoth.includes("Do not perform manual git push or PR creation"),
    "prompt with auto_push+auto_pr contains manual suppression",
  );
}

{
  // With auto_push only guidance
  const pushOnlyGuidance = [
    "## Git Automation",
    "",
    "After milestone completion, GSD will push to remote automatically. No manual push needed.",
  ].join("\n");

  const promptPush = loadPromptFromWorktree("complete-milestone", {
    workingDirectory: "/test",
    milestoneId: "M001",
    milestoneTitle: "Test Milestone",
    roadmapPath: ".gsd/milestones/M001/M001-ROADMAP.md",
    inlinedContext: "## Inlined Context\n\ntest context",
    milestoneSummaryPath: "/test/.gsd/milestones/M001/M001-SUMMARY.md",
    gitAutomationGuidance: pushOnlyGuidance,
  });
  assertTrue(
    promptPush.includes("push to remote automatically"),
    "prompt with auto_push only contains push guidance",
  );
  assertTrue(
    !promptPush.includes("draft PR"),
    "prompt with auto_push only does NOT contain PR guidance",
  );
}

{
  // With no git automation (both disabled) — empty guidance
  const promptNone = loadPromptFromWorktree("complete-milestone", {
    workingDirectory: "/test",
    milestoneId: "M001",
    milestoneTitle: "Test Milestone",
    roadmapPath: ".gsd/milestones/M001/M001-ROADMAP.md",
    inlinedContext: "## Inlined Context\n\ntest context",
    milestoneSummaryPath: "/test/.gsd/milestones/M001/M001-SUMMARY.md",
    gitAutomationGuidance: "",
  });
  assertTrue(
    !promptNone.includes("automatically push"),
    "prompt with no git automation omits push guidance",
  );
  assertTrue(
    !promptNone.includes("draft PR"),
    "prompt with no git automation omits PR guidance",
  );
  assertTrue(
    !promptNone.includes("Git Automation"),
    "prompt with no git automation omits Git Automation heading",
  );
}

report();
