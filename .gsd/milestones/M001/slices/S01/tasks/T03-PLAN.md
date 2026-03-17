---
estimated_steps: 4
estimated_files: 1
---

# T03: Wire verification gate into auto.ts handleAgentEnd

**Slice:** S01 — Built-in Verification Gate
**Milestone:** M001

## Description

Insert the verification gate call into `handleAgentEnd` in `auto.ts` so it fires automatically after every execute-task completion. This is a surgical edit — approximately 25 lines added to a single function in a 3700+ line file. The gate fires after artifact verification and runtime record cleanup, but before post-unit hooks. Only triggers for `execute-task` unit type per D001.

## Steps

1. **Add import** at the top of `src/resources/extensions/gsd/auto.ts` (in the import block, around line 1-50):
   ```ts
   import { runVerificationGate } from "./verification-gate.js";
   ```
   Also ensure `loadEffectiveGSDPreferences` is imported from `./preferences.js` (check if it's already imported — it likely is for existing preference usage).

2. **Find the insertion point** in `handleAgentEnd`. The gate goes after the `clearUnitRuntimeRecord` block for non-hook units and before the DB dual-write section. Specifically, look for this sequence (around lines 1481–1489):
   ```
   clearUnitRuntimeRecord(basePath, currentUnit.type, currentUnit.id);
   ```
   ...followed by a block comment about DB dual-write. The gate block goes between these two sections.

3. **Add the verification gate block:**
   ```ts
   // ── Verification gate: run typecheck/lint/test after execute-task ──
   if (currentUnit.type === "execute-task") {
     try {
       const effectivePrefs = loadEffectiveGSDPreferences();
       const prefs = effectivePrefs?.preferences;
       
       // Read task plan verify field from the current task's plan
       // unitId format is like "S01/T02" — extract slice and task IDs
       const parts = currentUnit.id.split("/");
       let taskPlanVerify: string | undefined;
       if (parts.length === 2) {
         const { readSlicePlan } = await import("./files.js");
         const slicePlan = readSlicePlan(basePath, parts[0]);
         const taskEntry = slicePlan?.tasks?.find(t => t.id === parts[1]);
         taskPlanVerify = taskEntry?.verify;
       }
       
       const result = runVerificationGate({
         basePath,
         unitId: currentUnit.id,
         cwd: basePath,
         preferenceCommands: prefs?.verification_commands,
         taskPlanVerify,
       });
       
       if (result.checks.length > 0) {
         const passCount = result.checks.filter(c => c.exitCode === 0).length;
         const total = result.checks.length;
         if (result.passed) {
           ctx.ui.notify(`Verification gate: ${passCount}/${total} checks passed`);
         } else {
           const failures = result.checks.filter(c => c.exitCode !== 0);
           const failNames = failures.map(f => f.command).join(", ");
           ctx.ui.notify(`Verification gate: FAILED — ${failNames}`);
           process.stderr.write(`verification-gate: ${total - passCount}/${total} checks failed\n`);
           for (const f of failures) {
             process.stderr.write(`  ${f.command} exited ${f.exitCode}\n`);
             if (f.stderr) process.stderr.write(`  stderr: ${f.stderr.slice(0, 500)}\n`);
           }
         }
       }
     } catch (err) {
       // Gate errors are non-fatal — log and continue
       process.stderr.write(`verification-gate: error — ${(err as Error).message}\n`);
     }
   }
   ```

4. **Verify no regressions** — Run the full test suite. The gate only fires for `execute-task` units in auto-mode, and no existing test simulates a full auto-mode lifecycle that reaches this code path. All tests should pass unchanged.

   Important constraints:
   - The gate must be INSIDE the `if (!currentUnit.type.startsWith("hook/"))` block — it already is, because execute-task never starts with "hook/"
   - The gate must NOT alter `currentUnit.type` or `currentUnit.id`
   - The gate must NOT throw — wrap in try/catch to keep handleAgentEnd resilient
   - Import uses `.js` extension (TypeScript project compiles to JS with `.js` extensions in imports)
   - Use `readSlicePlan` from `files.ts` (already exists) to get the task plan verify field — this function reads the slice plan markdown and returns parsed `SlicePlan` with tasks

## Must-Haves

- [ ] `runVerificationGate` imported and called in `handleAgentEnd`
- [ ] Gate fires only when `currentUnit.type === "execute-task"`
- [ ] Gate fires after `clearUnitRuntimeRecord`, before DB dual-write and before `checkPostUnitHooks`
- [ ] Results logged via `ctx.ui.notify()` — pass count on success, command names on failure
- [ ] Entire gate block wrapped in try/catch — errors logged to stderr, never crash handleAgentEnd
- [ ] All existing tests pass (`npm run test:unit`)

## Verification

- `npm run test:unit` — all existing tests pass
- Code review: gate call is inside the non-hook block, before hooks, guarded by execute-task type check
- `grep -n "runVerificationGate" src/resources/extensions/gsd/auto.ts` shows exactly one call site

## Observability Impact

- Signals added: `ctx.ui.notify()` message with pass/fail counts; stderr output for failures with command name and exit code
- How a future agent inspects this: check stdout/stderr during auto-mode run for "Verification gate:" messages
- Failure state exposed: failing command names, exit codes, first 500 chars of stderr per failure

## Inputs

- `src/resources/extensions/gsd/auto.ts` — existing file; insertion point at line ~1481-1489 between clearUnitRuntimeRecord and DB dual-write
- `src/resources/extensions/gsd/verification-gate.ts` — T01 output: exports `runVerificationGate`
- `src/resources/extensions/gsd/files.ts` — existing `readSlicePlan` function for parsing task plan verify field
- `src/resources/extensions/gsd/preferences.ts` — existing `loadEffectiveGSDPreferences` function

## Expected Output

- `src/resources/extensions/gsd/auto.ts` — modified with ~25 lines added in `handleAgentEnd`, one new import line
