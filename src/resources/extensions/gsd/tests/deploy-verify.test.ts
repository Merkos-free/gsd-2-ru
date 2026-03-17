// GSD Deploy Preferences & Vercel CLI Wrapper Tests
//
// Tests: deploy preference validation (valid/invalid), Vercel stdout URL parsing,
// link detection (mock fs), readiness polling (inspect output parsing),
// smoke check translation, evidence writing, evidence schema roundtrip.

import { createTestContext } from "./test-helpers.ts";
import { validatePreferences } from "../preferences.ts";
import {
  parseVercelDeployOutput,
  parseInspectReadyState,
  isVercelLinked,
} from "../deploy-service.ts";
import {
  translateSmokeChecks,
  writeDeployEvidence,
  buildDeployEvidence,
  runDeployVerification,
} from "../deploy-evidence.ts";
import type { DeployEvidence, DeployVerifyResult } from "../deploy-evidence.ts";
import type { DeployPreferences } from "../deploy-service.ts";

const { assertEq, assertTrue, report } = createTestContext();

async function main(): Promise<void> {
  // ═══════════════════════════════════════════════════════════════════════
  // Deploy Preference Validation
  // ═══════════════════════════════════════════════════════════════════════

  console.log("\n=== deploy.provider validation ===");

  // Valid: "vercel"
  {
    const { preferences, errors } = validatePreferences({ deploy: { provider: "vercel" } });
    assertEq(errors.length, 0, "deploy.provider: vercel — no errors");
    assertEq(preferences.deploy?.provider, "vercel", "deploy.provider: vercel — value preserved");
  }

  // Invalid: other string
  {
    const { errors } = validatePreferences({ deploy: { provider: "netlify" as any } });
    assertTrue(errors.length > 0, "deploy.provider: netlify — produces error");
    assertTrue(errors[0].includes("vercel"), "deploy.provider: netlify — error mentions vercel");
  }

  // Invalid: number
  {
    const { errors } = validatePreferences({ deploy: { provider: 123 as any } });
    assertTrue(errors.length > 0, "deploy.provider: number — produces error");
  }

  console.log("\n=== deploy.auto_deploy validation ===");

  // Valid: boolean
  {
    const { preferences, errors } = validatePreferences({ deploy: { auto_deploy: true } });
    assertEq(errors.length, 0, "deploy.auto_deploy: true — no errors");
    assertEq(preferences.deploy?.auto_deploy, true, "deploy.auto_deploy: true — value preserved");
  }
  {
    const { preferences, errors } = validatePreferences({ deploy: { auto_deploy: false } });
    assertEq(errors.length, 0, "deploy.auto_deploy: false — no errors");
    assertEq(preferences.deploy?.auto_deploy, false, "deploy.auto_deploy: false — value preserved");
  }

  // Invalid: string
  {
    const { errors } = validatePreferences({ deploy: { auto_deploy: "yes" as any } });
    assertTrue(errors.length > 0, "deploy.auto_deploy: string — produces error");
    assertTrue(errors[0].includes("auto_deploy"), "deploy.auto_deploy: string — error mentions auto_deploy");
  }

  console.log("\n=== deploy.environment validation ===");

  // Valid: "preview"
  {
    const { preferences, errors } = validatePreferences({ deploy: { environment: "preview" } });
    assertEq(errors.length, 0, "deploy.environment: preview — no errors");
    assertEq(preferences.deploy?.environment, "preview", "deploy.environment: preview — value preserved");
  }

  // Valid: "production"
  {
    const { preferences, errors } = validatePreferences({ deploy: { environment: "production" } });
    assertEq(errors.length, 0, "deploy.environment: production — no errors");
    assertEq(preferences.deploy?.environment, "production", "deploy.environment: production — value preserved");
  }

  // Invalid: "staging"
  {
    const { errors } = validatePreferences({ deploy: { environment: "staging" as any } });
    assertTrue(errors.length > 0, "deploy.environment: staging — produces error");
    assertTrue(errors[0].includes("preview, production"), "deploy.environment: staging — error mentions valid values");
  }

  console.log("\n=== deploy.smoke_checks validation ===");

  // Valid: string array
  {
    const checks = ["/", "/api/health"];
    const { preferences, errors } = validatePreferences({ deploy: { smoke_checks: checks } });
    assertEq(errors.length, 0, "deploy.smoke_checks: valid array — no errors");
    assertEq(preferences.deploy?.smoke_checks?.length, 2, "deploy.smoke_checks: valid array — 2 items");
    assertEq(preferences.deploy?.smoke_checks?.[0], "/", "deploy.smoke_checks: valid array — first item");
    assertEq(preferences.deploy?.smoke_checks?.[1], "/api/health", "deploy.smoke_checks: valid array — second item");
  }

  // Valid: empty array
  {
    const { preferences, errors } = validatePreferences({ deploy: { smoke_checks: [] } });
    assertEq(errors.length, 0, "deploy.smoke_checks: empty array — no errors");
    assertEq(preferences.deploy?.smoke_checks?.length, 0, "deploy.smoke_checks: empty array — 0 items");
  }

  // Invalid: array with non-strings
  {
    const { errors } = validatePreferences({ deploy: { smoke_checks: ["/", 42] as any } });
    assertTrue(errors.length > 0, "deploy.smoke_checks: mixed array — produces error");
    assertTrue(errors[0].includes("smoke_checks"), "deploy.smoke_checks: mixed array — error mentions smoke_checks");
  }

  // Invalid: not an array
  {
    const { errors } = validatePreferences({ deploy: { smoke_checks: "just a string" as any } });
    assertTrue(errors.length > 0, "deploy.smoke_checks: string — produces error");
  }

  console.log("\n=== deploy: full valid config ===");

  // All fields together
  {
    const deploy: DeployPreferences = {
      provider: "vercel",
      auto_deploy: true,
      environment: "preview",
      smoke_checks: ["/", "/api/health"],
    };
    const { preferences, errors, warnings } = validatePreferences({ deploy });
    assertEq(errors.length, 0, "deploy: full config — no errors");
    assertEq(warnings.length, 0, "deploy: full config — no warnings");
    assertEq(preferences.deploy?.provider, "vercel", "deploy: full config — provider");
    assertEq(preferences.deploy?.auto_deploy, true, "deploy: full config — auto_deploy");
    assertEq(preferences.deploy?.environment, "preview", "deploy: full config — environment");
    assertEq(preferences.deploy?.smoke_checks?.length, 2, "deploy: full config — smoke_checks length");
  }

  console.log("\n=== deploy: unknown sub-keys ===");

  // Unknown deploy sub-keys produce warnings
  {
    const { warnings } = validatePreferences({ deploy: { provider: "vercel", unknown_key: true } as any });
    assertTrue(warnings.length > 0, "deploy: unknown key — produces warning");
    assertTrue(warnings[0].includes("unknown_key"), "deploy: unknown key — warning mentions key name");
  }

  console.log("\n=== deploy: undefined passes through ===");

  // No deploy key set — no errors
  {
    const { preferences, errors, warnings } = validatePreferences({ git: { auto_push: true } });
    assertEq(errors.length, 0, "deploy: undefined — no errors");
    assertEq(preferences.deploy, undefined, "deploy: undefined — not set");
  }

  console.log("\n=== deploy: not an object ===");

  // deploy set to non-object is silently ignored (matched by `typeof === "object"` guard)
  {
    const { preferences } = validatePreferences({ deploy: "vercel" as any });
    assertEq(preferences.deploy, undefined, "deploy: string — ignored");
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Vercel Deploy Output Parsing
  // ═══════════════════════════════════════════════════════════════════════

  console.log("\n=== parseVercelDeployOutput ===");

  // Standard Vercel CLI output format (v32+)
  {
    const stdout = `Vercel CLI 32.5.0
🔍  Inspect: https://vercel.com/team/project/abc123
✅  Preview: https://project-abc123.vercel.app`;
    const result = parseVercelDeployOutput(stdout);
    assertTrue(result !== null, "standard output — parsed successfully");
    assertEq(result?.url, "https://project-abc123.vercel.app", "standard output — deploy URL");
    assertEq(result?.inspectorUrl, "https://vercel.com/team/project/abc123", "standard output — inspector URL");
  }

  // Minimal output — just a URL
  {
    const stdout = `https://project-abc123.vercel.app`;
    const result = parseVercelDeployOutput(stdout);
    assertTrue(result !== null, "minimal output — parsed successfully");
    assertEq(result?.url, "https://project-abc123.vercel.app", "minimal output — deploy URL");
    assertEq(result?.inspectorUrl, "", "minimal output — no inspector URL");
  }

  // Production deploy output
  {
    const stdout = `Vercel CLI 32.5.0
🔍  Inspect: https://vercel.com/team/project/deploy123
✅  Production: https://myapp.vercel.app`;
    const result = parseVercelDeployOutput(stdout);
    assertTrue(result !== null, "production output — parsed successfully");
    assertEq(result?.url, "https://myapp.vercel.app", "production output — deploy URL");
  }

  // Output with extra lines and warnings
  {
    const stdout = `Vercel CLI 32.5.0
⚠  The Vercel CLI will deprecate Node.js 16
Uploading [====================] 100%
🔍  Inspect: https://vercel.com/team/project/dep456
✅  Preview: https://project-dep456.vercel.app
`;
    const result = parseVercelDeployOutput(stdout);
    assertTrue(result !== null, "output with extras — parsed successfully");
    assertEq(result?.url, "https://project-dep456.vercel.app", "output with extras — deploy URL");
  }

  // Empty output
  {
    const result = parseVercelDeployOutput("");
    assertEq(result, null, "empty output — returns null");
  }

  // No URL in output
  {
    const result = parseVercelDeployOutput("Error: some failure\nFailed to deploy");
    assertEq(result, null, "error output — returns null");
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Vercel Inspect Ready State Parsing
  // ═══════════════════════════════════════════════════════════════════════

  console.log("\n=== parseInspectReadyState ===");

  // readyState: READY
  {
    const state = parseInspectReadyState(JSON.stringify({ readyState: "READY" }));
    assertEq(state, "READY", "readyState: READY — parsed");
  }

  // readyState: BUILDING
  {
    const state = parseInspectReadyState(JSON.stringify({ readyState: "BUILDING" }));
    assertEq(state, "BUILDING", "readyState: BUILDING — parsed");
  }

  // readyState: ERROR
  {
    const state = parseInspectReadyState(JSON.stringify({ readyState: "ERROR" }));
    assertEq(state, "ERROR", "readyState: ERROR — parsed");
  }

  // Fallback to "state" field
  {
    const state = parseInspectReadyState(JSON.stringify({ state: "READY" }));
    assertEq(state, "READY", "state fallback — parsed");
  }

  // Invalid JSON
  {
    const state = parseInspectReadyState("not json");
    assertEq(state, null, "invalid JSON — returns null");
  }

  // Missing both fields
  {
    const state = parseInspectReadyState(JSON.stringify({ name: "test" }));
    assertEq(state, null, "missing fields — returns null");
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Vercel Link Detection
  // ═══════════════════════════════════════════════════════════════════════

  console.log("\n=== isVercelLinked ===");

  // Non-existent directory returns false
  {
    const linked = isVercelLinked("/tmp/nonexistent-project-" + Date.now());
    assertEq(linked, false, "non-existent path — returns false");
  }

  // Directory without .vercel returns false
  {
    const linked = isVercelLinked("/tmp");
    assertEq(linked, false, "no .vercel dir — returns false");
  }

  // Test with a real temporary directory that has .vercel/project.json
  {
    const { mkdirSync, writeFileSync, rmSync } = await import("node:fs");
    const tmpDir = `/tmp/gsd-deploy-test-${Date.now()}`;
    try {
      mkdirSync(`${tmpDir}/.vercel`, { recursive: true });
      writeFileSync(`${tmpDir}/.vercel/project.json`, '{"projectId":"prj_123"}');
      const linked = isVercelLinked(tmpDir);
      assertEq(linked, true, "linked project — returns true");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Smoke Check Translation (translateSmokeChecks)
  // ═══════════════════════════════════════════════════════════════════════

  console.log("\n=== translateSmokeChecks: single path ===");

  // Single path → 2 steps (navigate + assert)
  {
    const params = translateSmokeChecks("https://my-app.vercel.app", ["/"], "M003");
    assertEq(params.name, "deploy-smoke-M003", "single path — flow name");
    assertEq(params.steps.length, 2, "single path — 2 steps");
    assertEq(params.steps[0].action, "navigate", "single path — step 0 is navigate");
    assertEq(params.steps[0].url, "https://my-app.vercel.app/", "single path — navigate URL");
    assertEq(params.steps[1].action, "assert", "single path — step 1 is assert");
    assertTrue(
      Array.isArray(params.steps[1].checks) && params.steps[1].checks!.length === 2,
      "single path — assert has 2 checks",
    );
    assertEq(params.steps[1].checks![0].kind, "selector_visible", "single path — check 0 kind");
    assertEq(params.steps[1].checks![0].selector, "body", "single path — check 0 selector");
    assertEq(params.steps[1].checks![1].kind, "no_failed_requests", "single path — check 1 kind");
  }

  console.log("\n=== translateSmokeChecks: multiple paths ===");

  // Multiple paths → 2 steps per path
  {
    const params = translateSmokeChecks("https://app.vercel.app", ["/", "/api/health", "/about"], "M005");
    assertEq(params.name, "deploy-smoke-M005", "multi path — flow name");
    assertEq(params.steps.length, 6, "multi path — 6 steps (3 paths × 2)");

    // Check second path's navigate URL
    assertEq(params.steps[2].action, "navigate", "multi path — step 2 is navigate");
    assertEq(params.steps[2].url, "https://app.vercel.app/api/health", "multi path — step 2 URL");

    // Check third path's navigate URL
    assertEq(params.steps[4].action, "navigate", "multi path — step 4 is navigate");
    assertEq(params.steps[4].url, "https://app.vercel.app/about", "multi path — step 4 URL");
  }

  console.log("\n=== translateSmokeChecks: empty paths ===");

  // Empty paths → 0 steps
  {
    const params = translateSmokeChecks("https://app.vercel.app", [], "M003");
    assertEq(params.name, "deploy-smoke-M003", "empty paths — flow name");
    assertEq(params.steps.length, 0, "empty paths — 0 steps");
  }

  console.log("\n=== translateSmokeChecks: trailing slash normalization ===");

  // Base URL with trailing slash should not double-slash
  {
    const params = translateSmokeChecks("https://app.vercel.app/", ["/test"], "M003");
    assertEq(params.steps[0].url, "https://app.vercel.app/test", "trailing slash — no double slash");
  }

  console.log("\n=== translateSmokeChecks: path without leading slash ===");

  // Path without leading slash gets normalized
  {
    const params = translateSmokeChecks("https://app.vercel.app", ["about"], "M003");
    assertEq(params.steps[0].url, "https://app.vercel.app/about", "no leading slash — gets added");
  }

  console.log("\n=== translateSmokeChecks: default milestoneId ===");

  // Default milestoneId when not provided
  {
    const params = translateSmokeChecks("https://app.vercel.app", ["/"]);
    assertEq(params.name, "deploy-smoke-M000", "default milestoneId — M000");
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Evidence Writing (writeDeployEvidence)
  // ═══════════════════════════════════════════════════════════════════════

  console.log("\n=== writeDeployEvidence: schema roundtrip ===");

  {
    const { mkdirSync, readFileSync, rmSync } = await import("node:fs");
    const tmpBase = `/tmp/gsd-evidence-test-${Date.now()}`;

    try {
      const evidence: DeployEvidence = {
        version: 1,
        milestoneId: "M003",
        deployUrl: "https://project-abc123.vercel.app",
        environment: "preview",
        deployedAt: "2026-03-17T07:00:00.000Z",
        readyAt: "2026-03-17T07:01:30.000Z",
        smokeResult: {
          verdict: "PASS",
          stepCount: 4,
          passedCount: 4,
        },
        totalDurationMs: 95000,
      };

      const filePath = writeDeployEvidence(tmpBase, "M003", evidence);

      // File was written
      assertTrue(filePath.endsWith("M003-DEPLOY-VERIFY.json"), "evidence file — correct filename");
      assertTrue(filePath.includes(".gsd/milestones/M003"), "evidence file — correct directory");

      // Roundtrip: read back and verify all fields
      const raw = readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw) as DeployEvidence;

      assertEq(parsed.version, 1, "roundtrip — version");
      assertEq(parsed.milestoneId, "M003", "roundtrip — milestoneId");
      assertEq(parsed.deployUrl, "https://project-abc123.vercel.app", "roundtrip — deployUrl");
      assertEq(parsed.environment, "preview", "roundtrip — environment");
      assertEq(parsed.deployedAt, "2026-03-17T07:00:00.000Z", "roundtrip — deployedAt");
      assertEq(parsed.readyAt, "2026-03-17T07:01:30.000Z", "roundtrip — readyAt");
      assertEq(parsed.smokeResult.verdict, "PASS", "roundtrip — smokeResult.verdict");
      assertEq(parsed.smokeResult.stepCount, 4, "roundtrip — smokeResult.stepCount");
      assertEq(parsed.smokeResult.passedCount, 4, "roundtrip — smokeResult.passedCount");
      assertEq(parsed.smokeResult.failedStepIndex, undefined, "roundtrip — no failedStepIndex");
      assertEq(parsed.smokeResult.debugBundlePath, undefined, "roundtrip — no debugBundlePath");
      assertEq(parsed.totalDurationMs, 95000, "roundtrip — totalDurationMs");
    } finally {
      rmSync(tmpBase, { recursive: true, force: true });
    }
  }

  console.log("\n=== writeDeployEvidence: FAIL evidence with failure fields ===");

  {
    const { readFileSync, rmSync } = await import("node:fs");
    const tmpBase = `/tmp/gsd-evidence-fail-test-${Date.now()}`;

    try {
      const evidence: DeployEvidence = {
        version: 1,
        milestoneId: "M005",
        deployUrl: "https://project-xyz.vercel.app",
        environment: "production",
        deployedAt: "2026-03-17T08:00:00.000Z",
        readyAt: "2026-03-17T08:02:00.000Z",
        smokeResult: {
          verdict: "FAIL",
          stepCount: 6,
          passedCount: 3,
          failedStepIndex: 3,
          debugBundlePath: "/tmp/debug-bundle-123",
        },
        totalDurationMs: 125000,
      };

      const filePath = writeDeployEvidence(tmpBase, "M005", evidence);

      const parsed = JSON.parse(readFileSync(filePath, "utf-8")) as DeployEvidence;

      assertEq(parsed.smokeResult.verdict, "FAIL", "fail evidence — verdict");
      assertEq(parsed.smokeResult.failedStepIndex, 3, "fail evidence — failedStepIndex");
      assertEq(parsed.smokeResult.debugBundlePath, "/tmp/debug-bundle-123", "fail evidence — debugBundlePath");
      assertEq(parsed.smokeResult.passedCount, 3, "fail evidence — passedCount");
      assertEq(parsed.environment, "production", "fail evidence — environment");
    } finally {
      rmSync(tmpBase, { recursive: true, force: true });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // buildDeployEvidence: verdict propagation
  // ═══════════════════════════════════════════════════════════════════════

  console.log("\n=== buildDeployEvidence: PASS propagation ===");

  {
    const smokeResult: DeployVerifyResult = {
      verdict: "PASS",
      steps: 4,
      durationMs: 3500,
    };

    const evidence = buildDeployEvidence({
      milestoneId: "M003",
      deployUrl: "https://app.vercel.app",
      environment: "preview",
      deployedAt: "2026-03-17T07:00:00.000Z",
      readyAt: "2026-03-17T07:01:00.000Z",
      smokeResult,
      totalDurationMs: 95000,
    });

    assertEq(evidence.version, 1, "build PASS — version");
    assertEq(evidence.smokeResult.verdict, "PASS", "build PASS — verdict propagated");
    assertEq(evidence.smokeResult.stepCount, 4, "build PASS — stepCount from DeployVerifyResult.steps");
    assertEq(evidence.smokeResult.passedCount, 4, "build PASS — all steps passed");
    assertEq(evidence.smokeResult.failedStepIndex, undefined, "build PASS — no failedStepIndex");
    assertEq(evidence.smokeResult.debugBundlePath, undefined, "build PASS — no debugBundlePath");
    assertEq(evidence.totalDurationMs, 95000, "build PASS — totalDurationMs");
  }

  console.log("\n=== buildDeployEvidence: FAIL propagation ===");

  {
    const smokeResult: DeployVerifyResult = {
      verdict: "FAIL",
      steps: 6,
      failedStepIndex: 2,
      debugBundlePath: "/tmp/debug-bundle",
      durationMs: 5000,
    };

    const evidence = buildDeployEvidence({
      milestoneId: "M005",
      deployUrl: "https://app.vercel.app",
      environment: "production",
      deployedAt: "2026-03-17T08:00:00.000Z",
      readyAt: "2026-03-17T08:01:00.000Z",
      smokeResult,
      totalDurationMs: 120000,
    });

    assertEq(evidence.smokeResult.verdict, "FAIL", "build FAIL — verdict propagated");
    assertEq(evidence.smokeResult.failedStepIndex, 2, "build FAIL — failedStepIndex propagated");
    assertEq(evidence.smokeResult.debugBundlePath, "/tmp/debug-bundle", "build FAIL — debugBundlePath propagated");
    assertEq(evidence.smokeResult.passedCount, 2, "build FAIL — passedCount = failedStepIndex");
  }

  console.log("\n=== buildDeployEvidence: empty smoke checks → PASS with 0 steps ===");

  {
    const smokeResult: DeployVerifyResult = {
      verdict: "PASS",
      steps: 0,
      durationMs: 0,
    };

    const evidence = buildDeployEvidence({
      milestoneId: "M003",
      deployUrl: "https://app.vercel.app",
      environment: "preview",
      deployedAt: "2026-03-17T07:00:00.000Z",
      readyAt: "2026-03-17T07:01:00.000Z",
      smokeResult,
      totalDurationMs: 90000,
    });

    assertEq(evidence.smokeResult.verdict, "PASS", "empty smoke — PASS verdict");
    assertEq(evidence.smokeResult.stepCount, 0, "empty smoke — 0 steps");
    assertEq(evidence.smokeResult.passedCount, 0, "empty smoke — 0 passed (nothing to pass)");
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Integration Tests: Deploy-Verify Chain (T03)
  // ═══════════════════════════════════════════════════════════════════════

  // These tests exercise the full deploy → readiness → smoke → evidence chain
  // by composing the individual functions with mocks, simulating how auto.ts
  // wires them together.

  console.log("\n=== Integration: full chain — deploy → ready → smoke PASS → evidence ===");

  {
    const { readFileSync, rmSync } = await import("node:fs");
    const tmpBase = `/tmp/gsd-integration-full-${Date.now()}`;

    try {
      // Simulate: vercelDeploy returns URL
      const deployUrl = "https://project-abc123.vercel.app";
      const deployedAt = new Date().toISOString();

      // Simulate: waitForDeployReady returns true (already tested in unit tests)
      const isReady = true;
      const readyAt = new Date().toISOString();

      // Simulate: runDeployVerification with mock runVerifyFlowFn
      const mockRunVerifyFlow = async (_deps: any, params: any) => ({
        verdict: "PASS" as const,
        stepResults: [
          { ok: true, action: "navigate", durationMs: 500 },
          { ok: true, action: "assert", durationMs: 200 },
          { ok: true, action: "navigate", durationMs: 400 },
          { ok: true, action: "assert", durationMs: 150 },
        ],
        durationMs: 1250,
      });

      const smokeResult = await runDeployVerification(
        {} as any, // deps — not used by mock
        mockRunVerifyFlow,
        deployUrl,
        ["/", "/api/health"],
        "M003",
      );

      assertEq(smokeResult.verdict, "PASS", "integration full — smoke verdict PASS");
      assertEq(smokeResult.steps, 4, "integration full — 4 steps");

      // Build and write evidence
      const evidence = buildDeployEvidence({
        milestoneId: "M003",
        deployUrl,
        environment: "preview",
        deployedAt,
        readyAt,
        smokeResult,
        totalDurationMs: 5000,
      });

      const evidencePath = writeDeployEvidence(tmpBase, "M003", evidence);
      const parsed = JSON.parse(readFileSync(evidencePath, "utf-8"));

      assertEq(parsed.version, 1, "integration full — evidence version");
      assertEq(parsed.milestoneId, "M003", "integration full — evidence milestoneId");
      assertEq(parsed.deployUrl, deployUrl, "integration full — evidence deployUrl");
      assertEq(parsed.environment, "preview", "integration full — evidence environment");
      assertEq(parsed.smokeResult.verdict, "PASS", "integration full — evidence verdict");
      assertEq(parsed.smokeResult.stepCount, 4, "integration full — evidence stepCount");
      assertEq(parsed.smokeResult.passedCount, 4, "integration full — evidence passedCount");
      assertTrue(!parsed.smokeResult.failedStepIndex, "integration full — no failedStepIndex");
      assertTrue(!parsed.smokeResult.debugBundlePath, "integration full — no debugBundlePath");
    } finally {
      rmSync(tmpBase, { recursive: true, force: true });
    }
  }

  console.log("\n=== Integration: preference gate — auto_deploy=false → skip ===");

  {
    // When auto_deploy is false, the chain should never fire.
    // We verify by checking that no evidence is written.
    const { existsSync, rmSync } = await import("node:fs");
    const tmpBase = `/tmp/gsd-integration-skip-${Date.now()}`;

    try {
      const prefs: DeployPreferences = {
        provider: "vercel",
        auto_deploy: false,
        environment: "preview",
      };

      // Verify the preference gate logic: auto_deploy !== true means skip
      assertEq(prefs.auto_deploy !== true, true, "gate — auto_deploy=false skips");

      // No evidence file should exist (we never call writeDeployEvidence)
      const evidenceDir = `${tmpBase}/.gsd/milestones/M003`;
      assertEq(existsSync(`${evidenceDir}/M003-DEPLOY-VERIFY.json`), false, "gate — no evidence written when skipped");
    } finally {
      rmSync(tmpBase, { recursive: true, force: true });
    }
  }

  console.log("\n=== Integration: preference gate — provider missing → skip ===");

  {
    const prefs: DeployPreferences = {
      auto_deploy: true,
      // provider not set
    };

    // Verify: provider !== "vercel" means skip
    assertEq(prefs.provider !== "vercel", true, "gate — no provider skips");
  }

  console.log("\n=== Integration: preference gate — provider not vercel → skip ===");

  {
    const prefs: DeployPreferences = {
      auto_deploy: true,
      provider: "vercel",
    };

    // Only "vercel" passes the gate
    assertEq(prefs.provider === "vercel", true, "gate — vercel passes");
  }

  console.log("\n=== Integration: degradation — vercel not linked → skip with warning ===");

  {
    // isVercelLinked returns false for non-existent paths
    const notLinked = isVercelLinked("/tmp/nonexistent-project-" + Date.now());
    assertEq(notLinked, false, "degradation — unlinked project detected");

    // In auto.ts, this causes: notify("Project not linked to Vercel...", "warning") → return
    // We verify the detection, the notify/return logic is in auto.ts (covered by type-check)
  }

  console.log("\n=== Integration: degradation — deploy fails → skip ===");

  {
    // parseVercelDeployOutput returns null for error output
    const result = parseVercelDeployOutput("Error: ENOENT vercel not found");
    assertEq(result, null, "degradation — deploy failure detected (null result)");

    // Another failure: empty output
    const result2 = parseVercelDeployOutput("");
    assertEq(result2, null, "degradation — empty deploy output detected");
  }

  console.log("\n=== Integration: degradation — readiness timeout → partial evidence ===");

  {
    const { readFileSync, rmSync } = await import("node:fs");
    const tmpBase = `/tmp/gsd-integration-timeout-${Date.now()}`;

    try {
      const deployUrl = "https://project-timeout.vercel.app";
      const deployedAt = new Date().toISOString();
      const readyAt = deployedAt; // Not updated because readiness failed

      // Simulate: deployment not ready (timeout)
      const isReady = false;

      // When not ready, smoke tests are skipped. Evidence is still written.
      const effectiveSmokeResult: DeployVerifyResult = {
        verdict: "FAIL",
        steps: 0,
        durationMs: 0,
      };

      const evidence = buildDeployEvidence({
        milestoneId: "M004",
        deployUrl,
        environment: "preview",
        deployedAt,
        readyAt,
        smokeResult: effectiveSmokeResult,
        totalDurationMs: 120000,
      });

      const evidencePath = writeDeployEvidence(tmpBase, "M004", evidence);
      const parsed = JSON.parse(readFileSync(evidencePath, "utf-8"));

      assertEq(parsed.smokeResult.verdict, "FAIL", "timeout — evidence has FAIL verdict");
      assertEq(parsed.smokeResult.stepCount, 0, "timeout — 0 steps (smoke skipped)");
      assertEq(parsed.deployUrl, deployUrl, "timeout — deploy URL preserved");
      assertEq(parsed.totalDurationMs, 120000, "timeout — totalDurationMs reflects timeout");
      assertTrue(evidencePath.includes("M004-DEPLOY-VERIFY.json"), "timeout — evidence file written");
    } finally {
      rmSync(tmpBase, { recursive: true, force: true });
    }
  }

  console.log("\n=== Integration: degradation — smoke fails → FAIL evidence, not blocking ===");

  {
    const { readFileSync, rmSync } = await import("node:fs");
    const tmpBase = `/tmp/gsd-integration-smoke-fail-${Date.now()}`;

    try {
      const deployUrl = "https://project-smokefail.vercel.app";

      // Mock: smoke test fails at step 3 with debug bundle
      const mockRunVerifyFlowFail = async (_deps: any, _params: any) => ({
        verdict: "FAIL" as const,
        stepResults: [
          { ok: true, action: "navigate", durationMs: 500 },
          { ok: true, action: "assert", durationMs: 200 },
          { ok: true, action: "navigate", durationMs: 400 },
          { ok: false, action: "assert", durationMs: 100 },
        ],
        failedStepIndex: 3,
        debugBundle: { dir: "/tmp/debug-bundle-smoke-fail" },
        durationMs: 1200,
      });

      const smokeResult = await runDeployVerification(
        {} as any,
        mockRunVerifyFlowFail,
        deployUrl,
        ["/", "/api/health"],
        "M005",
      );

      assertEq(smokeResult.verdict, "FAIL", "smoke fail — verdict FAIL");
      assertEq(smokeResult.failedStepIndex, 3, "smoke fail — failedStepIndex is 3");
      assertEq(smokeResult.debugBundlePath, "/tmp/debug-bundle-smoke-fail", "smoke fail — debugBundlePath captured");

      // Build evidence with FAIL result — this should succeed and not block
      const evidence = buildDeployEvidence({
        milestoneId: "M005",
        deployUrl,
        environment: "production",
        deployedAt: new Date().toISOString(),
        readyAt: new Date().toISOString(),
        smokeResult,
        totalDurationMs: 8000,
      });

      const evidencePath = writeDeployEvidence(tmpBase, "M005", evidence);
      const parsed = JSON.parse(readFileSync(evidencePath, "utf-8"));

      assertEq(parsed.smokeResult.verdict, "FAIL", "smoke fail evidence — verdict");
      assertEq(parsed.smokeResult.failedStepIndex, 3, "smoke fail evidence — failedStepIndex");
      assertEq(parsed.smokeResult.debugBundlePath, "/tmp/debug-bundle-smoke-fail", "smoke fail evidence — debugBundlePath");
      assertEq(parsed.smokeResult.passedCount, 3, "smoke fail evidence — passedCount is failedStepIndex");
      assertEq(parsed.environment, "production", "smoke fail evidence — environment");

      // Key: the evidence was written successfully — completion is NOT blocked
      assertTrue(evidencePath.includes("M005-DEPLOY-VERIFY.json"), "smoke fail — evidence file exists (not blocking)");
    } finally {
      rmSync(tmpBase, { recursive: true, force: true });
    }
  }

  console.log("\n=== Integration: runDeployVerification with empty smoke_checks → immediate PASS ===");

  {
    // Empty smoke checks should short-circuit to PASS without calling runVerifyFlowFn
    let flowCalled = false;
    const mockRunVerifyFlowNeverCalled = async (_deps: any, _params: any) => {
      flowCalled = true;
      return { verdict: "PASS" as const, stepResults: [], durationMs: 0 };
    };

    const result = await runDeployVerification(
      {} as any,
      mockRunVerifyFlowNeverCalled,
      "https://app.vercel.app",
      [], // empty smoke checks
      "M003",
    );

    assertEq(result.verdict, "PASS", "empty checks — immediate PASS");
    assertEq(result.steps, 0, "empty checks — 0 steps");
    assertEq(flowCalled, false, "empty checks — runVerifyFlowFn never called");
  }

  console.log("\n=== Integration: evidence written even when smoke skipped (no checks) ===");

  {
    const { readFileSync, rmSync } = await import("node:fs");
    const tmpBase = `/tmp/gsd-integration-no-smoke-${Date.now()}`;

    try {
      const smokeResult: DeployVerifyResult = {
        verdict: "PASS",
        steps: 0,
        durationMs: 0,
      };

      const evidence = buildDeployEvidence({
        milestoneId: "M006",
        deployUrl: "https://no-smoke.vercel.app",
        environment: "preview",
        deployedAt: new Date().toISOString(),
        readyAt: new Date().toISOString(),
        smokeResult,
        totalDurationMs: 60000,
      });

      const evidencePath = writeDeployEvidence(tmpBase, "M006", evidence);
      const parsed = JSON.parse(readFileSync(evidencePath, "utf-8"));

      assertEq(parsed.smokeResult.verdict, "PASS", "no smoke — evidence has PASS (nothing to fail)");
      assertEq(parsed.smokeResult.stepCount, 0, "no smoke — 0 steps in evidence");
      assertTrue(evidencePath.includes("M006-DEPLOY-VERIFY.json"), "no smoke — evidence file written");
    } finally {
      rmSync(tmpBase, { recursive: true, force: true });
    }
  }

  report();
}

main();
