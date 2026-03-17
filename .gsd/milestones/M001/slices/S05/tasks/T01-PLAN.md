---
estimated_steps: 5
estimated_files: 3
---

# T01: Implement runDependencyAudit with types and unit tests

**Slice:** S05 — Dependency Security Scan
**Milestone:** M001

## Description

Add the `AuditWarning` interface to `types.ts` and implement `runDependencyAudit(cwd, options?)` in `verification-gate.ts`. This function detects package.json/lockfile changes via git diff and conditionally runs `npm audit --audit-level=moderate --json`, parsing the JSON output into `AuditWarning[]`. Uses dependency injection (D023 pattern) for testability — injectable `gitDiff` and `npmAudit` functions so tests don't need real git repos or npm registries.

Key constraints:
- `npm audit` exits non-zero when vulnerabilities exist — this is expected, not an error. Parse JSON stdout regardless of exit code.
- Graceful failure on: non-git dirs, missing lockfile, npm not found, invalid JSON stdout.
- Results are always non-blocking — this function never affects `result.passed`.
- Match only top-level files: `package.json`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`.

## Steps

1. **Add `AuditWarning` to `types.ts`:** Add the interface after the existing `RuntimeError` interface. Fields: `name: string`, `severity: "low" | "moderate" | "high" | "critical"`, `title: string`, `url: string`, `fixAvailable: boolean`. Add `auditWarnings?: AuditWarning[]` optional field to `VerificationResult` (same pattern as `runtimeErrors`).

2. **Add `DependencyAuditOptions` interface and `runDependencyAudit()` to `verification-gate.ts`:** The options interface provides injectable `gitDiff` and `npmAudit` functions (D023 pattern). `gitDiff` returns `string[]` of changed file paths. `npmAudit` returns `{ stdout: string; exitCode: number }`. The function:
   - Calls `gitDiff(cwd)` (default: `spawnSync("git", ["diff", "--name-only", "HEAD"], { cwd })`)
   - Checks if any returned path matches the lockfile/manifest pattern set (basename match for top-level only)
   - If no match, returns `[]`
   - Calls `npmAudit(cwd)` (default: `spawnSync("npm", ["audit", "--audit-level=moderate", "--json"], { cwd })`)
   - Parses JSON stdout to extract vulnerabilities — iterate `vulnerabilities` object, extract `name`, `severity`, `fixAvailable`, and `title`/`url` from the first `via` entry that's an object (not a string)
   - Returns `AuditWarning[]`
   - Wraps everything in try/catch — any error returns `[]`

3. **Implement default `gitDiff` function:** Uses `spawnSync("git", ["diff", "--name-only", "HEAD"], { cwd, encoding: "utf-8", timeout: 10000 })`. Returns empty array if exit code is non-zero (not a git repo) or stdout is empty.

4. **Implement default `npmAudit` function:** Uses `spawnSync("npm", ["audit", "--audit-level=moderate", "--json"], { cwd, encoding: "utf-8", timeout: 60000 })`. Returns `{ stdout, exitCode }`. Note: non-zero exit is expected when vulnerabilities exist.

5. **Write unit tests in `verification-gate.test.ts`:** Add tests after the existing `captureRuntimeErrors` test block. All tests use dependency injection — no real git or npm calls. Test cases:
   - `dependency-audit: package.json in git diff → runs npm audit and parses vulnerabilities`
   - `dependency-audit: package-lock.json change triggers audit`
   - `dependency-audit: pnpm-lock.yaml change triggers audit`
   - `dependency-audit: yarn.lock change triggers audit`
   - `dependency-audit: bun.lockb change triggers audit`
   - `dependency-audit: no dependency file changes → returns empty array, npm audit not called`
   - `dependency-audit: git diff returns non-zero exit (not a git repo) → empty array`
   - `dependency-audit: npm audit returns invalid JSON → empty array`
   - `dependency-audit: npm audit returns zero vulnerabilities → empty array`
   - `dependency-audit: npm audit non-zero exit with valid JSON → parses correctly` (key edge case)
   - `dependency-audit: via entries with string-only values are skipped`
   - `dependency-audit: subdirectory package.json does not trigger audit` (e.g. `packages/foo/package.json`)

## Must-Haves

- [ ] `AuditWarning` interface added to `types.ts` with all 5 fields
- [ ] `auditWarnings?: AuditWarning[]` field added to `VerificationResult`
- [ ] `runDependencyAudit(cwd, options?)` exported from `verification-gate.ts`
- [ ] Dependency injection via options for `gitDiff` and `npmAudit` (D023 pattern)
- [ ] Graceful failure on all error paths (returns `[]`, never throws)
- [ ] Non-zero npm audit exit code treated as expected behavior
- [ ] All dependency-audit tests pass

## Verification

- `npm run test:unit -- --test-name-pattern "dependency-audit"` — all new tests pass
- `npx --yes tsx src/resources/extensions/gsd/verification-gate.ts` — compiles cleanly
- `npm run test:unit -- --test-name-pattern "verification-gate"` — existing 28+ tests still pass

## Observability Impact

- Signals added: `runDependencyAudit()` returns structured `AuditWarning[]` data for downstream consumption
- How a future agent inspects this: call `runDependencyAudit(cwd)` directly or check `result.auditWarnings` after gate runs
- Failure state exposed: empty array on any error — stderr logging for errors is deferred to T02 (auto.ts wiring)

## Inputs

- `src/resources/extensions/gsd/types.ts` — existing `RuntimeError` and `VerificationResult` interfaces (pattern to follow)
- `src/resources/extensions/gsd/verification-gate.ts` — existing `CaptureRuntimeErrorsOptions` and `captureRuntimeErrors()` (D023 pattern to mirror)
- `src/resources/extensions/gsd/tests/verification-gate.test.ts` — existing test patterns for dependency injection style

## Expected Output

- `src/resources/extensions/gsd/types.ts` — `AuditWarning` interface added, `auditWarnings` field on `VerificationResult`
- `src/resources/extensions/gsd/verification-gate.ts` — `DependencyAuditOptions` interface and `runDependencyAudit()` function exported
- `src/resources/extensions/gsd/tests/verification-gate.test.ts` — 10+ new `dependency-audit:` tests appended
