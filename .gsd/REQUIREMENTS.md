# Requirements

This file is the explicit capability and coverage contract for the project.

## Active

### R001 — A built-in post-unit hook fires after every execute-task completion, runs discovered verification commands, and blocks task completion until all pass or explicit override.
- Class: core-capability
- Status: active
- Description: A built-in post-unit hook fires after every execute-task completion, runs discovered verification commands, and blocks task completion until all pass or explicit override.
- Why it matters: Without mechanical enforcement, verification is prompt-dependent (~30% coverage). This makes it mandatory (~95%).
- Source: user
- Primary owning slice: M001/S01
- Supporting slices: M001/S03
- Validation: unmapped
- Notes: Must integrate with existing hook engine without creating hook-on-hook chains. Built-in hooks are distinct from user-configured hooks.

### R002 — Verification gate discovers commands from (a) `verification_commands` preference, (b) task plan `verify:` field, (c) package.json scripts (typecheck, lint, test). Preference overrides auto-detection.
- Class: core-capability
- Status: active
- Description: Verification gate discovers commands from (a) `verification_commands` preference, (b) task plan `verify:` field, (c) package.json scripts (typecheck, lint, test). Preference overrides auto-detection.
- Why it matters: Auto-detection is ergonomic for projects with standard scripts. Preference override gives control for non-standard setups.
- Source: user
- Primary owning slice: M001/S01
- Supporting slices: none
- Validation: unmapped
- Notes: Discovery order: explicit preference → task plan → package.json. First non-empty source wins.

### R003 — Every task summary contains a canonical verification evidence table. A machine-readable T##-VERIFY.json is written alongside the summary.
- Class: primary-user-loop
- Status: active
- Description: Every task summary contains a canonical verification evidence table. A machine-readable T##-VERIFY.json is written alongside the summary.
- Why it matters: Structured evidence enables downstream querying (milestone validation, regression audit) without parsing prose.
- Source: user
- Primary owning slice: M001/S02
- Supporting slices: none
- Validation: unmapped
- Notes: JSON schema must be stable and versioned. Evidence includes check name, command/tool, expected, observed, verdict.

### R004 — The verification gate validates that the task summary contains a well-formed evidence block before allowing completion. Missing or malformed evidence blocks fail the gate.
- Class: quality-attribute
- Status: active
- Description: The verification gate validates that the task summary contains a well-formed evidence block before allowing completion. Missing or malformed evidence blocks fail the gate.
- Why it matters: Ensures evidence is always present and machine-parseable, not just encouraged by prompts.
- Source: user
- Primary owning slice: M001/S02
- Supporting slices: none
- Validation: unmapped
- Notes: Extends observability-validator.ts with evidence block structure checks.

### R005 — When verification commands fail, the agent gets up to 2 auto-fix attempts. Failure context (stderr, exit code) is injected into the retry prompt. After 2 failures, the gate fails and surfaces for human review.
- Class: core-capability
- Status: active
- Description: When verification commands fail, the agent gets up to 2 auto-fix attempts. Failure context (stderr, exit code) is injected into the retry prompt. After 2 failures, the gate fails and surfaces for human review.
- Why it matters: Most verification failures are fixable (typos, missing imports, lint issues). Auto-fix eliminates unnecessary human pauses.
- Source: user
- Primary owning slice: M001/S03
- Supporting slices: none
- Validation: unmapped
- Notes: Uses module-level retry state parallel to pendingCrashRecovery pattern (not hook retry_on). Max retries configurable via `verification_max_retries` preference.

### R006 — After browser verification or dev server execution, the verification gate captures and reviews server stderr/stdout from bg-shell processes and browser console errors.
- Class: failure-visibility
- Status: active
- Description: After browser verification or dev server execution, the verification gate captures and reviews server stderr/stdout from bg-shell processes and browser console errors.
- Why it matters: Prevents "tests pass but server is crashing" blindness. Surfaces runtime errors that static checks miss.
- Source: user
- Primary owning slice: M001/S04
- Supporting slices: none
- Validation: unmapped
- Notes: Signals: server stderr from bg-shell, browser console errors, unhandled promise rejections, deprecation warnings.

### R007 — Unhandled rejections and process crashes fail the verification gate. Console.error and deprecation warnings are logged in evidence but do not block.
- Class: quality-attribute
- Status: active
- Description: Unhandled rejections and process crashes fail the verification gate. Console.error and deprecation warnings are logged in evidence but do not block.
- Why it matters: Distinguishes fatal from informational — prevents false failures from third-party library noise while catching real crashes.
- Source: user
- Primary owning slice: M001/S04
- Supporting slices: none
- Validation: unmapped
- Notes: Severity classification: crash/unhandled rejection = blocking. console.error/deprecation = logged, non-blocking.

### R009 — Expand UAT types to 5: artifact-driven, browser-executable, runtime-executable, human-judgment, mixed. Only human-judgment and mixed pause for human review.
- Class: core-capability
- Status: active
- Description: Expand UAT types to 5: artifact-driven, browser-executable, runtime-executable, human-judgment, mixed. Only human-judgment and mixed pause for human review.
- Why it matters: Currently ~70% of UAT pauses for humans. After expansion, ~20% (only genuinely subjective checks).
- Source: user
- Primary owning slice: M002/S01
- Supporting slices: M002/S04
- Validation: unmapped
- Notes: Extends existing UatType union in files.ts. Updates pauseAfterDispatch logic in auto-dispatch.ts.

### R010 — A higher-level browser tool that composes existing primitives (navigate, assert, fill_form, screenshot, batch, diff) into deterministic, evidence-producing flows with retry and failure capture.
- Class: core-capability
- Status: active
- Description: A higher-level browser tool that composes existing primitives (navigate, assert, fill_form, screenshot, batch, diff) into deterministic, evidence-producing flows with retry and failure capture.
- Why it matters: Currently the agent composes many primitive calls each time. This reduces token cost and increases determinism for common verification patterns.
- Source: user
- Primary owning slice: M002/S02
- Supporting slices: none
- Validation: unmapped
- Notes: Lives in browser-tools/ as a general extension, not GSD-specific. Input: flow steps with assertions. Output: structured PASS/FAIL + debug bundle.

### R011 — A declarative project-level contract (.gsd/RUNTIME.md) specifying how to boot, seed, and observe the application. Consumed by execute-task and run-uat prompts.
- Class: continuity
- Status: active
- Description: A declarative project-level contract (.gsd/RUNTIME.md) specifying how to boot, seed, and observe the application. Consumed by execute-task and run-uat prompts.
- Why it matters: Eliminates repeated ad-hoc inference of startup commands. Makes boot/seed/observe deterministic.
- Source: user
- Primary owning slice: M002/S03
- Supporting slices: M002/S04
- Validation: unmapped
- Notes: Fields: startup command, readiness probe, services, seed command, preview URLs, observability endpoints.

### R012 — Agent auto-generates RUNTIME.md during milestone planning by analyzing package.json scripts, docker-compose, and project config.
- Class: continuity
- Status: active
- Description: Agent auto-generates RUNTIME.md during milestone planning by analyzing package.json scripts, docker-compose, and project config.
- Why it matters: User doesn't need to manually author the stack contract. Agent infers it from project evidence.
- Source: user
- Primary owning slice: M002/S03
- Supporting slices: none
- Validation: unmapped
- Notes: Generated during plan-milestone or plan-slice. Updated when stack changes. User can override.

### R013 — For browser-executable and runtime-executable UAT, the agent boots the app using RUNTIME.md, runs the verification flow, then tears down. Fully autonomous.
- Class: core-capability
- Status: active
- Description: For browser-executable and runtime-executable UAT, the agent boots the app using RUNTIME.md, runs the verification flow, then tears down. Fully autonomous.
- Why it matters: Currently UAT requires human to have the app running. Full lifecycle enables true autonomous verification.
- Source: user
- Primary owning slice: M002/S04
- Supporting slices: none
- Validation: unmapped
- Notes: Requires RUNTIME.md to exist. Falls back to current behavior if missing.

### R014 — Opt-in automation: after complete-milestone, push milestone branch to remote and create draft PR with milestone summary as body. Preference-gated via git.auto_push and git.auto_pr.
- Class: operability
- Status: active
- Description: Opt-in automation: after complete-milestone, push milestone branch to remote and create draft PR with milestone summary as body. Preference-gated via git.auto_push and git.auto_pr.
- Why it matters: Eliminates manual git ceremony per milestone. Draft PRs only — never auto-merge.
- Source: user
- Primary owning slice: M003/S01
- Supporting slices: none
- Validation: unmapped
- Notes: Milestone-level only. Uses gh CLI for PR creation. Runs gh pr checks and reports status.

### R015 — Post-milestone hook that deploys via Vercel CLI/MCP, polls for deployment readiness, runs browser smoke tests against the preview URL, and writes deployment verification evidence.
- Class: operability
- Status: active
- Description: Post-milestone hook that deploys via Vercel CLI/MCP, polls for deployment readiness, runs browser smoke tests against the preview URL, and writes deployment verification evidence.
- Why it matters: Closes the local→production gap. Local verification doesn't catch deploy-time issues.
- Source: user
- Primary owning slice: M003/S02
- Supporting slices: none
- Validation: unmapped
- Notes: Vercel first. Uses vercel CLI (installed at /opt/homebrew/bin/vercel) or Vercel MCP. Smoke checks via browser_verify_flow.

### R016 — Upgrade supervisor from timer-driven watchdog to bounded diagnostic reasoning: inspect activity logs, check bg-shell processes for crashes, distinguish stuck from long-running, inject recovery context, request one bounded retry before escalating.
- Class: failure-visibility
- Status: active
- Description: Upgrade supervisor from timer-driven watchdog to bounded diagnostic reasoning: inspect activity logs, check bg-shell processes for crashes, distinguish stuck from long-running, inject recovery context, request one bounded retry before escalating.
- Why it matters: Current supervisor only detects timeouts. Bounded diagnostics enables smarter recovery without human intervention (~40% → ~60% autonomous recovery).
- Source: user
- Primary owning slice: M004/S01
- Supporting slices: none
- Validation: unmapped
- Notes: Authority boundaries: CAN inspect, diagnose, inject context, request retry. CANNOT edit files, commit, push, or silently skip.

### R017 — Supervisor uses activity heuristics to distinguish "stuck" (no tool calls, no file changes) from "long-running" (active tool usage, git changes accumulating). Only intervenes on genuine stalls.
- Class: quality-attribute
- Status: active
- Description: Supervisor uses activity heuristics to distinguish "stuck" (no tool calls, no file changes) from "long-running" (active tool usage, git changes accumulating). Only intervenes on genuine stalls.
- Why it matters: Prevents false-positive timeouts on legitimately complex tasks.
- Source: user
- Primary owning slice: M004/S01
- Supporting slices: none
- Validation: unmapped
- Notes: Heuristics: working-tree activity (already exists), tool call recency from activity logs, bg-shell process health.

## Validated

### R008 — If package.json or lockfile changed during task execution, `npm audit --audit-level=moderate` runs. High/critical vulnerabilities appear in evidence as warnings. Non-blocking — warn, don't fail.
- Class: quality-attribute
- Status: validated
- Description: If package.json or lockfile changed during task execution, `npm audit --audit-level=moderate` runs. High/critical vulnerabilities appear in evidence as warnings. Non-blocking — warn, don't fail.
- Why it matters: Catches supply-chain risks early without interrupting flow for low-severity issues.
- Source: user
- Primary owning slice: M001/S05
- Supporting slices: none
- Validation: 12 unit tests (dependency-audit:*) cover all lockfile types, graceful failures, JSON parsing, subdirectory exclusion. 6 evidence tests prove JSON/markdown persistence. Wiring confirmed in auto.ts (import line 23, call line 1540). Gate never fails on audit warnings. Full suite: 1106 pass, 8 pre-existing fail.
- Notes: Conditional — only fires when package manifest changes detected via git diff.

## Deferred

### R018 — Abstract deploy-and-verify across multiple providers (Vercel, Railway, custom). Currently Vercel-only.
- Class: operability
- Status: deferred
- Description: Abstract deploy-and-verify across multiple providers (Vercel, Railway, custom). Currently Vercel-only.
- Why it matters: Future-proofs deploy hook for diverse deployment targets.
- Source: research
- Primary owning slice: none
- Supporting slices: none
- Validation: unmapped
- Notes: Deferred until a second provider is actually needed. Vercel covers the immediate use case.

### R019 — Supervisor gets its own LLM reasoning pass (Haiku for triage, stronger model for escalation) to analyze failures, generate hypotheses, and craft recovery prompts.
- Class: quality-attribute
- Status: deferred
- Description: Supervisor gets its own LLM reasoning pass (Haiku for triage, stronger model for escalation) to analyze failures, generate hypotheses, and craft recovery prompts.
- Why it matters: More powerful but higher cost per timeout event. Bounded diagnostics covers the immediate need.
- Source: user
- Primary owning slice: none
- Supporting slices: none
- Validation: unmapped
- Notes: Deferred — bounded diagnostics first. Upgrade path: add LLM pass when heuristic-based diagnostics prove insufficient.

## Traceability

| ID | Class | Status | Primary owner | Supporting | Proof |
|---|---|---|---|---|---|
| R001 | core-capability | active | M001/S01 | M001/S03 | unmapped |
| R002 | core-capability | active | M001/S01 | none | unmapped |
| R003 | primary-user-loop | active | M001/S02 | none | unmapped |
| R004 | quality-attribute | active | M001/S02 | none | unmapped |
| R005 | core-capability | active | M001/S03 | none | unmapped |
| R006 | failure-visibility | active | M001/S04 | none | unmapped |
| R007 | quality-attribute | active | M001/S04 | none | unmapped |
| R008 | quality-attribute | validated | M001/S05 | none | 12 unit tests (dependency-audit:*) cover all lockfile types, graceful failures, JSON parsing, subdirectory exclusion. 6 evidence tests prove JSON/markdown persistence. Wiring confirmed in auto.ts (import line 23, call line 1540). Gate never fails on audit warnings. Full suite: 1106 pass, 8 pre-existing fail. |
| R009 | core-capability | active | M002/S01 | M002/S04 | unmapped |
| R010 | core-capability | active | M002/S02 | none | unmapped |
| R011 | continuity | active | M002/S03 | M002/S04 | unmapped |
| R012 | continuity | active | M002/S03 | none | unmapped |
| R013 | core-capability | active | M002/S04 | none | unmapped |
| R014 | operability | active | M003/S01 | none | unmapped |
| R015 | operability | active | M003/S02 | none | unmapped |
| R016 | failure-visibility | active | M004/S01 | none | unmapped |
| R017 | quality-attribute | active | M004/S01 | none | unmapped |
| R018 | operability | deferred | none | none | unmapped |
| R019 | quality-attribute | deferred | none | none | unmapped |

## Coverage Summary

- Active requirements: 16
- Mapped to slices: 16
- Validated: 1 (R008)
- Unmapped active requirements: 0
