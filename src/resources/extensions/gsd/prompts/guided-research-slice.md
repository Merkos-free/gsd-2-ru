<!--
  Guided variant of research-slice.md.
  Full version: prompts/research-slice.md (used by auto-mode via auto-prompts.ts).

  Selected by guided-flow.ts → showSmartEntry() when:
    - The user runs /gsd, the active slice's phase is "planning", and the user
      picks "Research first".

  This prompt is concise because guided-flow has already confirmed the slice is
  ready for research. The full auto-mode prompt inlines context, decisions, and
  knowledge artifacts.
-->
Research slice {{sliceId}} ("{{sliceTitle}}") of milestone {{milestoneId}}. Read `.gsd/DECISIONS.md` if it exists — respect existing decisions, don't contradict them. Read `.gsd/REQUIREMENTS.md` if it exists — identify which Active requirements this slice owns or supports and target research toward risks, unknowns, and constraints that could affect delivery of those requirements. If a `GSD Skill Preferences` block is present in system context, use it to decide which skills to load and follow during research, without relaxing required verification or artifact rules. Explore the relevant code — use `rg`/`find` for targeted reads, or `scout` if the area is broad or unfamiliar. Check libraries with `resolve_library`/`get_library_docs` — skip this for libraries already used in the codebase. Use the **Research** output template below. Write `{{sliceId}}-RESEARCH.md` in the slice directory.

**You are the scout.** A planner agent reads your output in a fresh context to decompose this slice into tasks. Write for the planner — surface key files, where the work divides naturally, what to build first, and how to verify. If the research doc is vague, the planner re-explores code you already read. If it's precise, the planner decomposes immediately.

## Strategic Questions to Answer

Research should drive planning decisions, not just collect facts. Explicitly address:

- **What should be proven first?** What's the riskiest assumption — the thing that, if wrong, invalidates downstream work?
- **What existing patterns should be reused?** What modules, conventions, or infrastructure already exist that the plan should build on rather than reinvent?
- **What boundary contracts matter?** What interfaces, data shapes, event formats, or invariants will slices need to agree on?
- **What constraints does the existing codebase impose?** What can't be changed, what's expensive to change, what patterns must be respected?
- **Are there known failure modes that should shape slice ordering?** Pitfalls that mean certain work should come before or after other work?

{{inlinedTemplates}}
