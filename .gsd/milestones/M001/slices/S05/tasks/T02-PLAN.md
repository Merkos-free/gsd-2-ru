---
estimated_steps: 4
estimated_files: 4
---

# T02: Wire audit into evidence formatting and auto.ts gate block

**Slice:** S05 — Dependency Security Scan
**Milestone:** M001

## Description

Connect `runDependencyAudit()` to the verification pipeline. Extend evidence JSON and markdown formatting to include audit warnings. Wire the function call into auto.ts gate block after `captureRuntimeErrors()`. Add evidence tests for the new audit warning fields.

Key constraints:
- Audit warnings are always non-blocking — never affect `result.passed`.
- Follow existing `runtimeErrors` conditional pattern exactly: include in JSON/markdown only when array is non-empty.
- The auto.ts wiring goes after `captureRuntimeErrors()` and before the auto-fix retry logic.
- stderr logging: log warning count when audit finds issues, log skip message when no dependency changes.

## Steps

1. **Extend `verification-evidence.ts` with audit warning support:**
   - Add `AuditWarningJSON` interface: `{ name: string; severity: string; title: string; url: string; fixAvailable: boolean }`.
   - Add `auditWarnings?: AuditWarningJSON[]` to `EvidenceJSON`.
   - In `writeVerificationJSON()`: after the runtimeErrors conditional block, add the same pattern for `result.auditWarnings` — if the array is non-empty, map each `AuditWarning` to `AuditWarningJSON` and attach to the evidence object.
   - In `formatEvidenceTable()`: after the runtime errors section, add a conditional "Audit Warnings" section when `result.auditWarnings` has entries. Format: markdown table with columns `#`, `Package`, `Severity`, `Title`, `Fix Available`. Use severity emojis: 🔴 critical, 🟠 high, 🟡 moderate, ⚪ low.

2. **Wire `runDependencyAudit()` into auto.ts gate block:**
   - Add `runDependencyAudit` to the existing import from `"./verification-gate.js"`.
   - After the `captureRuntimeErrors()` block (~line 1537, after `result.runtimeErrors` is set and blocking check is done), add:
     ```
     // Conditional dependency audit (R008)
     const auditWarnings = runDependencyAudit(basePath);
     if (auditWarnings.length > 0) {
       result.auditWarnings = auditWarnings;
       process.stderr.write(`verification-gate: ${auditWarnings.length} audit warning(s)\n`);
       for (const w of auditWarnings) {
         process.stderr.write(`  [${w.severity}] ${w.name}: ${w.title}\n`);
       }
     }
     ```
   - Do NOT set `result.passed = false` — audit is always non-blocking.

3. **Add evidence tests in `verification-evidence.test.ts`:**
   - `verification-evidence: writeVerificationJSON includes auditWarnings when present` — pass a VerificationResult with `auditWarnings` array, verify JSON file contains `auditWarnings` field with correct shape.
   - `verification-evidence: writeVerificationJSON omits auditWarnings when absent` — no `auditWarnings` field in result, verify JSON has no `auditWarnings` key.
   - `verification-evidence: writeVerificationJSON omits auditWarnings when empty array` — empty array, verify JSON has no `auditWarnings` key.
   - `verification-evidence: formatEvidenceTable appends audit warnings section` — verify markdown includes "Audit Warnings" heading and table rows.
   - `verification-evidence: formatEvidenceTable omits audit warnings section when none` — verify no "Audit Warnings" text in output.
   - `verification-evidence: integration — VerificationResult with auditWarnings → JSON → table` — end-to-end evidence pipeline with audit data.

4. **Run full test suite and verify compilation:**
   - `npm run test:unit -- --test-name-pattern "verification-evidence"` — all evidence tests pass
   - `npm run test:unit` — full suite, no regressions
   - `npx --yes tsx src/resources/extensions/gsd/verification-evidence.ts` — compiles cleanly

## Must-Haves

- [ ] `AuditWarningJSON` interface and `auditWarnings` field added to `EvidenceJSON`
- [ ] `writeVerificationJSON` includes audit warnings conditionally (non-empty only)
- [ ] `formatEvidenceTable` appends "Audit Warnings" markdown section conditionally
- [ ] `runDependencyAudit()` wired into auto.ts gate block after `captureRuntimeErrors()`
- [ ] Audit warnings are non-blocking — `result.passed` is never modified by audit results
- [ ] stderr logging for audit warning count and details
- [ ] All new and existing evidence tests pass
- [ ] Full test suite passes with no new regressions

## Verification

- `npm run test:unit -- --test-name-pattern "verification-evidence"` — all evidence tests pass (existing + new)
- `npm run test:unit -- --test-name-pattern "dependency-audit"` — T01 tests still pass
- `npm run test:unit` — full suite, no regressions
- `grep -n "runDependencyAudit" src/resources/extensions/gsd/auto.ts` — shows import + call site (2 hits)

## Inputs

- `src/resources/extensions/gsd/types.ts` — `AuditWarning` interface and `auditWarnings` field on `VerificationResult` (from T01)
- `src/resources/extensions/gsd/verification-gate.ts` — `runDependencyAudit()` function (from T01)
- `src/resources/extensions/gsd/verification-evidence.ts` — existing `runtimeErrors` conditional pattern to mirror
- `src/resources/extensions/gsd/auto.ts` — existing gate block with `captureRuntimeErrors()` call (~line 1530)

## Expected Output

- `src/resources/extensions/gsd/verification-evidence.ts` — `AuditWarningJSON`, updated `EvidenceJSON`, extended `writeVerificationJSON` and `formatEvidenceTable`
- `src/resources/extensions/gsd/auto.ts` — `runDependencyAudit` import added, ~10-line audit block added after runtime errors
- `src/resources/extensions/gsd/tests/verification-evidence.test.ts` — 5-6 new `verification-evidence: ... auditWarnings` tests appended
