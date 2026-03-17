# GSD Prompts

Prompt templates that drive GSD agent behavior. Loaded by `prompt-loader.ts`, which reads all `.md` files at module init and substitutes `{{variable}}` placeholders at dispatch time.

## Two Prompt Variants: Guided vs Full

Each workflow step (execute-task, plan-slice, etc.) has up to two prompt variants:

### Full prompts (`<name>.md`)

Used by **auto-mode** (`auto-prompts.ts`). Auto-mode agents launch in a fresh context with no prior conversation, so full prompts inline all backing artifacts: task plans, slice plans, prior summaries, overrides, decisions, and context files. These prompts are long (50-150+ lines) because they must be entirely self-contained.

### Guided prompts (`guided-<name>.md`)

Used by the **interactive `/gsd` wizard** (`guided-flow.ts`). The guided flow runs inside an active conversation where `showSmartEntry()` has already resolved project state, presented an action menu, and gathered user intent. Guided prompts are concise (1-10 lines) because the surrounding conversation provides context that auto-mode agents lack.

### Selection logic

`guided-flow.ts` determines which guided prompt to load based on the current project phase and the user's menu selection:

| Phase | User action | Prompt loaded |
|---|---|---|
| No roadmap, no context | "Discuss first" | `guided-discuss-milestone` |
| No roadmap | "Create roadmap" | `guided-plan-milestone` |
| Planning (slice) | "Discuss first" | `guided-discuss-slice` |
| Planning (slice) | "Research first" | `guided-research-slice` |
| Planning (slice) | "Plan" | `guided-plan-slice` |
| Executing (task, no continue file) | "Execute \<taskId\>" | `guided-execute-task` |
| Executing (task, continue file exists) | "Resume \<taskId\>" | `guided-resume-task` |
| Summarizing (all tasks done) | "Complete \<sliceId\>" | `guided-complete-slice` |

`auto-prompts.ts` loads the corresponding full prompt (e.g., `execute-task`, `plan-slice`) when auto-mode dispatches a unit.

### Discussion prompts are guided-only

`guided-discuss-milestone` and `guided-discuss-slice` have no full auto-mode counterpart. Discussion is inherently interactive (interviewing the user), so it only runs through the guided flow. These "guided" files contain the complete interview protocol despite the `guided-` prefix.

## Templates

Output templates (defining artifact structure) live in `../templates/` and are inlined into prompts via `inlineTemplate()`. They are not prompt variants -- they define the expected format for artifacts like roadmaps, plans, summaries, and UAT files.
