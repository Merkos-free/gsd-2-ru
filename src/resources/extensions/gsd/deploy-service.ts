/**
 * GSD Deploy Service — Vercel CLI wrapper
 *
 * Provides link state detection, deployment execution, and readiness polling
 * for Vercel-hosted projects. All functions are designed for graceful degradation:
 * missing CLI, missing auth, unlinked projects → return null/false, never throw
 * unrecoverable errors.
 *
 * Observability: Return values are the diagnostic surface. Callers (auto.ts)
 * are responsible for logging deploy URL, readiness status, and failure reasons
 * via ctx.ui.notify. Vercel auth tokens are never included in return values.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DeployPreferences {
  provider?: "vercel";
  auto_deploy?: boolean;
  environment?: "preview" | "production";
  smoke_checks?: string[];
}

export interface DeployResult {
  url: string;
  inspectorUrl: string;
}

// ─── Link State Detection ───────────────────────────────────────────────────

/**
 * Check whether the project directory is linked to a Vercel project.
 * Looks for `.vercel/project.json` in the given base path.
 */
export function isVercelLinked(basePath: string): boolean {
  return existsSync(join(basePath, ".vercel", "project.json"));
}

// ─── Deployment ─────────────────────────────────────────────────────────────

/**
 * Parse a Vercel deploy URL from CLI stdout.
 * The deploy command outputs multiple lines; the deployment URL is the last
 * line matching an `https://` pattern. The inspector URL typically contains
 * the project dashboard path.
 *
 * Exported for testing.
 */
export function parseVercelDeployOutput(stdout: string): DeployResult | null {
  const lines = stdout.trim().split("\n").map(l => l.trim()).filter(Boolean);

  let url: string | null = null;
  let inspectorUrl: string = "";

  // Walk lines in reverse — the deployment URL is typically the last https:// line
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const match = line.match(/https:\/\/[^\s]+/);
    if (match) {
      if (!url) {
        url = match[0];
      } else if (!inspectorUrl) {
        inspectorUrl = match[0];
      }
    }
    // Stop once we have both
    if (url && inspectorUrl) break;
  }

  if (!url) return null;

  return { url, inspectorUrl };
}

/**
 * Run `vercel deploy --yes` (with `--prod` for production environment).
 * Parses the deployment URL from stdout.
 *
 * Returns null if:
 * - The `vercel` CLI is not installed
 * - Authentication is missing
 * - The deployment fails for any reason
 *
 * @param basePath - Project root directory
 * @param environment - "preview" (default) or "production"
 */
export function vercelDeploy(
  basePath: string,
  environment: "preview" | "production" = "preview",
): DeployResult | null {
  const args = ["deploy", "--yes"];
  if (environment === "production") {
    args.push("--prod");
  }

  try {
    const stdout = execFileSync("vercel", args, {
      cwd: basePath,
      encoding: "utf-8",
      timeout: 300_000, // 5 minute timeout for deploy
      stdio: ["pipe", "pipe", "pipe"],
    });

    return parseVercelDeployOutput(stdout);
  } catch (err: unknown) {
    // Surface the error message for callers to log
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("command not found") || msg.includes("ENOENT")) {
      // CLI not installed — caller should log "Vercel CLI not installed"
      return null;
    }
    // Auth errors, deploy failures, etc.
    return null;
  }
}

// ─── Readiness Polling ──────────────────────────────────────────────────────

/**
 * Parse the ready state from `vercel inspect --json` output.
 * Exported for testing.
 */
export function parseInspectReadyState(jsonOutput: string): string | null {
  try {
    const parsed = JSON.parse(jsonOutput);
    return parsed.readyState ?? parsed.state ?? null;
  } catch {
    return null;
  }
}

/**
 * Poll `vercel inspect {url} --json` until readyState is "READY" or timeout.
 *
 * @param url - The deployment URL to inspect
 * @param timeoutMs - Maximum time to wait (default: 120000ms = 2 minutes)
 * @param pollIntervalMs - Time between polls (default: 5000ms = 5 seconds)
 * @returns true if deployment became ready, false on timeout or error
 */
export function waitForDeployReady(
  url: string,
  timeoutMs: number = 120_000,
  pollIntervalMs: number = 5_000,
): boolean {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const stdout = execFileSync("vercel", ["inspect", url, "--json"], {
        encoding: "utf-8",
        timeout: 30_000,
        stdio: ["pipe", "pipe", "pipe"],
      });

      const state = parseInspectReadyState(stdout);
      if (state === "READY") return true;

      // If state indicates a terminal failure, stop polling
      if (state === "ERROR" || state === "CANCELED") return false;
    } catch {
      // inspect failed — continue polling unless timed out
    }

    // Sleep without burning CPU
    try { execFileSync("sleep", [String(pollIntervalMs / 1000)]); } catch { /* non-fatal */ }
  }

  return false;
}
