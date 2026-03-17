/**
 * Deploy Evidence — smoke test orchestration and evidence writing.
 *
 * Three responsibilities:
 *   1. translateSmokeChecks: convert URL paths → browser_verify_flow step arrays
 *   2. runDeployVerification: orchestrate smoke tests via runVerifyFlow
 *   3. writeDeployEvidence: persist M###-DEPLOY-VERIFY.json to milestone directory
 *
 * Observability: evidence JSON is the primary diagnostic surface.
 * On failure, smokeResult.debugBundlePath points to screenshot/console/network bundle.
 * All functions are pure or side-effect-isolated (only writeDeployEvidence touches disk).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { FlowParams, FlowResult } from "../browser-tools/tools/verify-flow.ts";
import type { ToolDeps } from "../browser-tools/state.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DeployVerifyResult {
  verdict: "PASS" | "FAIL";
  steps: number;
  failedStepIndex?: number;
  debugBundlePath?: string;
  durationMs: number;
}

export interface DeployEvidence {
  version: 1;
  milestoneId: string;
  deployUrl: string;
  environment: "preview" | "production";
  deployedAt: string; // ISO 8601
  readyAt: string;    // ISO 8601
  smokeResult: {
    verdict: "PASS" | "FAIL";
    stepCount: number;
    passedCount: number;
    failedStepIndex?: number;
    debugBundlePath?: string;
  };
  totalDurationMs: number;
}

// ─── Smoke Check Translation ────────────────────────────────────────────────

/**
 * Convert URL paths into browser_verify_flow steps.
 *
 * For each path, produces:
 *   1. navigate step → baseUrl + path
 *   2. assert step → body visible + no failed requests
 *
 * This is a minimal "page loads without error" smoke test.
 *
 * @param baseUrl - The deployment URL (e.g. "https://project-abc123.vercel.app")
 * @param paths - URL paths to check (e.g. ["/", "/api/health"])
 * @param milestoneId - Used for flow naming
 */
export function translateSmokeChecks(
  baseUrl: string,
  paths: string[],
  milestoneId: string = "M000",
): FlowParams {
  const steps: FlowParams["steps"] = [];

  for (const path of paths) {
    // Normalize: ensure path starts with /
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = `${baseUrl.replace(/\/+$/, "")}${normalizedPath}`;

    // Navigate to the URL
    steps.push({
      action: "navigate",
      url,
    });

    // Assert: page body is visible and no failed requests
    steps.push({
      action: "assert",
      checks: [
        { kind: "selector_visible", selector: "body" },
        { kind: "no_failed_requests" },
      ],
    });
  }

  return {
    name: `deploy-smoke-${milestoneId}`,
    steps,
  };
}

// ─── Deploy Verification Orchestration ──────────────────────────────────────

/**
 * Run smoke tests against a deployed URL.
 *
 * Empty smokeChecks array → immediate PASS with no steps (nothing to verify).
 * Non-empty → translates paths to flow steps and runs via browser_verify_flow.
 *
 * @param deps - Browser tool dependencies (for runVerifyFlow)
 * @param runVerifyFlowFn - Injected for testability; defaults to the real runVerifyFlow
 * @param deployUrl - The deployment URL
 * @param smokeChecks - URL paths to smoke test
 * @param milestoneId - For flow naming
 */
export async function runDeployVerification(
  deps: ToolDeps,
  runVerifyFlowFn: (deps: ToolDeps, params: FlowParams) => Promise<FlowResult>,
  deployUrl: string,
  smokeChecks: string[],
  milestoneId: string = "M000",
): Promise<DeployVerifyResult> {
  // Empty smoke checks → immediate PASS
  if (smokeChecks.length === 0) {
    return {
      verdict: "PASS",
      steps: 0,
      durationMs: 0,
    };
  }

  const flowParams = translateSmokeChecks(deployUrl, smokeChecks, milestoneId);
  const startMs = Date.now();
  const result = await runVerifyFlowFn(deps, flowParams);
  const durationMs = Date.now() - startMs;

  const passedCount = result.stepResults.filter(r => r.ok).length;

  return {
    verdict: result.verdict,
    steps: result.stepResults.length,
    failedStepIndex: result.failedStepIndex ?? undefined,
    debugBundlePath: result.debugBundle?.dir,
    durationMs,
  };
}

// ─── Evidence Writing ───────────────────────────────────────────────────────

/**
 * Write deployment verification evidence to the milestone directory.
 *
 * Creates `M###-DEPLOY-VERIFY.json` in `.gsd/milestones/M###/`.
 * The schema is versioned (version: 1) for forward-compatibility.
 *
 * @param basePath - Project root (contains .gsd/)
 * @param milestoneId - e.g. "M003"
 * @param evidence - The structured evidence payload
 * @returns The absolute path of the written file
 */
export function writeDeployEvidence(
  basePath: string,
  milestoneId: string,
  evidence: DeployEvidence,
): string {
  const dir = join(basePath, ".gsd", "milestones", milestoneId);
  mkdirSync(dir, { recursive: true });

  const filename = `${milestoneId}-DEPLOY-VERIFY.json`;
  const filePath = join(dir, filename);

  writeFileSync(filePath, JSON.stringify(evidence, null, 2) + "\n", "utf-8");

  return filePath;
}

/**
 * Build a DeployEvidence object from deploy + smoke test results.
 *
 * Utility to assemble the evidence payload before writing.
 */
export function buildDeployEvidence(opts: {
  milestoneId: string;
  deployUrl: string;
  environment: "preview" | "production";
  deployedAt: string;
  readyAt: string;
  smokeResult: DeployVerifyResult;
  totalDurationMs: number;
}): DeployEvidence {
  return {
    version: 1,
    milestoneId: opts.milestoneId,
    deployUrl: opts.deployUrl,
    environment: opts.environment,
    deployedAt: opts.deployedAt,
    readyAt: opts.readyAt,
    smokeResult: {
      verdict: opts.smokeResult.verdict,
      stepCount: opts.smokeResult.steps,
      passedCount: opts.smokeResult.verdict === "PASS" ? opts.smokeResult.steps : (opts.smokeResult.failedStepIndex ?? 0),
      failedStepIndex: opts.smokeResult.failedStepIndex,
      debugBundlePath: opts.smokeResult.debugBundlePath,
    },
    totalDurationMs: opts.totalDurationMs,
  };
}
