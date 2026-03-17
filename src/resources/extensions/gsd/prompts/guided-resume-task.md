<!--
  Guided variant of execute-task.md (resume path).
  Full version: prompts/execute-task.md (used by auto-mode via auto-prompts.ts).

  Selected by guided-flow.ts → showSmartEntry() when:
    - The user runs /gsd, the active slice has an active task WITH a continue file
      (either <sliceId>-CONTINUE.md or continue.md), and the user picks "Resume <taskId>".

  This prompt is concise because guided-flow has already resolved state and confirmed
  the user wants to resume. The full auto-mode prompt inlines the continue file contents
  and all backing artifacts directly.
-->
Resume interrupted work. Find the continue file (`{{sliceId}}-CONTINUE.md` or `continue.md`) in slice {{sliceId}} of milestone {{milestoneId}}, then pick up from where you left off. Delete the continue file after reading it. If a `GSD Skill Preferences` block is present in system context, use it to decide which skills to load and follow during execution, without relaxing required verification or artifact rules.
