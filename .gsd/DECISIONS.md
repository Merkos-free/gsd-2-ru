# Decisions Register

<!-- Append-only. Never edit or remove existing rows.
     To reverse a decision, add a new row that supersedes it.
     Read this file at the start of any planning or research phase. -->

| # | When | Scope | Decision | Choice | Rationale | Revisable? |
|---|------|-------|----------|--------|-----------|------------|
| D021 | M001/S02 | convention | T##-VERIFY.json content scope | Exclude stdout/stderr from JSON evidence; include only check metadata (command, exitCode, verdict, durationMs) | Prevents unbounded file sizes. stdout/stderr can contain secrets (API keys, env vars). Machine querying needs only pass/fail metadata, not raw output. | Yes |
| D022 | M001/S02 | arch | Evidence write failure behavior in auto.ts gate block | Non-fatal (try/catch with stderr log) — gate continues even if evidence write fails | Evidence writing is observability, not core flow. A disk error shouldn't block task completion when the gate itself passed. | Yes |
| D001 | M001 | arch | Verification gate implementation | Built-in hardcoded in auto.ts handleAgentEnd, before user hooks | Simpler than adding "built-in" hook concept to hook engine. No risk of user disabling it. Clear separation from user hooks. | Yes — if hook engine gets "built-in" profiles |
| D002 | M001 | arch | Verification evidence format | Dual: markdown table in summary + T##-VERIFY.json alongside | Markdown for human readability, JSON for machine querying. Both needed. | No |
| D003 | M001 | convention | Verification command discovery order | Explicit preference → task plan verify field → package.json scripts | Preference override gives control. Auto-detect from package.json is ergonomic fallback. | No |
| D004 | M001 | arch | Runtime error severity classification | Crashes/unhandled rejections block gate. console.error/deprecation logged but non-blocking | Prevents false failures from third-party noise while catching real crashes. | Yes — if false negatives prove common |
| D005 | M001 | convention | Auto-fix retry count | 2 retries (configurable via verification_max_retries preference) | Most failures fixable in 1-2 attempts. More than 2 wastes tokens on genuinely broken code. | Yes — preference-controlled |
| D006 | M003 | arch | Deploy-and-verify target | Vercel first (not Railway) | Aligns with actual workflow. Vercel CLI already installed. | Yes — when second provider needed |
| D007 | M002 | arch | browser_verify_flow location | General browser-tools extension, not GSD-specific | Reusable outside GSD. Consistent with browser-tools extension architecture. | No |
| D008 | M002 | arch | RUNTIME.md authoring | Auto-generated during planning from project analysis | User doesn't manually author. Agent infers from package.json, docker-compose, etc. | Yes — user can override |
| D009 | M004 | arch | Supervisor upgrade scope | Bounded diagnostics (heuristic-based), not full LLM reasoning pass | Lower cost, sufficient for immediate needs. LLM pass deferred to R019. | Yes — upgrade when heuristics prove insufficient |
| D010 | M002 | arch | browser_verify_flow input format | Structured step arrays (like browser_batch with assertions and retry) | Deterministic and replayable. Natural language would sacrifice reliability. | No |
| D011 | M002 | convention | Executable UAT step location | Inline in S##-UAT.md with structured `## Executable Checks` section | Keeps everything in one file. No separate flow file to manage. | Yes — if flow files prove useful |
| D012 | M002 | arch | UAT process teardown | Kill all bg-shell processes started for UAT after completion | Clean state. No leftover processes. User can restart if needed. | No |
| D013 | M002 | arch | RUNTIME.md scope | General-purpose: web apps, CLI tools, daemons, non-HTTP services | User's projects span diverse stack types. Web-only would be too narrow. | No |
| D014 | M002 | arch | browser_verify_flow failure artifacts | Full debug bundle (screenshot, console, network, HAR) | Maximum diagnostic value on failure. Cost is justified when something breaks. | No |
| D015 | M003 | convention | PR body content | Milestone summary directly as PR body | Includes all slice summaries, decisions, evidence. No separate PR-specific format. | Yes — if PR bodies prove too long |
| D016 | M003 | arch | Vercel deploy mechanism | Explicit vercel CLI deploy (not push-triggered) | Doesn't depend on Vercel git integration. More control over environment. | No |
| D017 | M003 | arch | Vercel deploy environment | Preview by default. Production requires explicit preference override. | Safety — never accidentally deploy to production. | No |
| D018 | M004 | arch | Supervisor recovery session | Same session injection (not fresh session) | Preserves in-session state. Lower overhead. | Yes — if fresh sessions prove more effective |
| D019 | M004 | arch | Supervisor diagnostic signals | Heuristic signals + brief activity summary | Activity summary gives richer recovery context than heuristics alone. Worth the small latency cost. | No |
| D020 | M004 | arch | Supervisor escalation path | Pause with structured diagnostic report | User sees what was tried, what was found, supervisor's assessment. Better than silent skip. | No |
| D023 | M001/S04 | convention | Testability pattern for async capture functions with optional dependencies | Dependency injection via options parameter (getProcesses, getConsoleLogs) instead of module mocking | Avoids complex ESM module mocking. Cleaner test setup. Production code uses dynamic import() as default, tests inject mock functions. Pattern established in captureRuntimeErrors() and should be reused for future capture functions. | Yes |
