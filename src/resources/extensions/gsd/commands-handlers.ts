/**
 * GSD Command Handlers — fire-and-forget handlers that delegate to other modules.
 *
 * Contains: handleDoctor, handleSteer, handleCapture, handleTriage, handleKnowledge,
 * handleRunHook, handleUpdate, handleSkillHealth
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@gsd/pi-coding-agent";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { deriveState } from "./state.js";
import { gsdRoot } from "./paths.js";
import { appendCapture, hasPendingCaptures, loadPendingCaptures } from "./captures.js";
import { appendOverride, appendKnowledge } from "./files.js";
import {
  formatDoctorIssuesForPrompt,
  formatDoctorReport,
  runGSDDoctor,
  selectDoctorScope,
  filterDoctorIssues,
} from "./doctor.js";
import { isAutoActive } from "./auto.js";
import { projectRoot } from "./commands.js";
import { loadPrompt } from "./prompt-loader.js";

export function dispatchDoctorHeal(pi: ExtensionAPI, scope: string | undefined, reportText: string, structuredIssues: string): void {
  const workflowPath = process.env.GSD_WORKFLOW_PATH ?? join(process.env.HOME ?? "~", ".pi", "GSD-WORKFLOW.md");
  const workflow = readFileSync(workflowPath, "utf-8");
  const prompt = loadPrompt("doctor-heal", {
    doctorSummary: reportText,
    structuredIssues,
    scopeLabel: scope ?? "active milestone / blocking scope",
    doctorCommandSuffix: scope ? ` ${scope}` : "",
  });

  const content = `Read the following GSD workflow protocol and execute exactly.\n\n${workflow}\n\n## Your Task\n\n${prompt}`;

  pi.sendMessage(
    { customType: "gsd-doctor-heal", content, display: false },
    { triggerTurn: true },
  );
}

export async function handleDoctor(args: string, ctx: ExtensionCommandContext, pi: ExtensionAPI): Promise<void> {
  const trimmed = args.trim();
  const parts = trimmed ? trimmed.split(/\s+/) : [];
  const mode = parts[0] === "fix" || parts[0] === "heal" || parts[0] === "audit" ? parts[0] : "doctor";
  const requestedScope = mode === "doctor" ? parts[0] : parts[1];
  const scope = await selectDoctorScope(projectRoot(), requestedScope);
  const effectiveScope = mode === "audit" ? requestedScope : scope;
  const report = await runGSDDoctor(projectRoot(), {
    fix: mode === "fix" || mode === "heal",
    scope: effectiveScope,
  });

  const reportText = formatDoctorReport(report, {
    scope: effectiveScope,
    includeWarnings: mode === "audit",
    maxIssues: mode === "audit" ? 50 : 12,
    title: mode === "audit" ? "Аудит GSD doctor." : mode === "heal" ? "Подготовка GSD doctor heal." : undefined,
  });

  ctx.ui.notify(reportText, report.ok ? "info" : "warning");

  if (mode === "heal") {
    const unresolved = filterDoctorIssues(report.issues, {
      scope: effectiveScope,
      includeWarnings: true,
    });
    const actionable = unresolved.filter(issue => issue.severity === "error" || issue.code === "all_tasks_done_missing_slice_uat" || issue.code === "slice_checked_missing_uat");
    if (actionable.length === 0) {
      ctx.ui.notify("Doctor heal не нашёл ничего, что можно передать LLM.", "info");
      return;
    }

    const structuredIssues = formatDoctorIssuesForPrompt(actionable);
    dispatchDoctorHeal(pi, effectiveScope, reportText, structuredIssues);
    ctx.ui.notify(`Doctor heal отправил в LLM ${actionable.length} проблем(ы).`, "info");
  }
}

export async function handleSkillHealth(args: string, ctx: ExtensionCommandContext): Promise<void> {
  const {
    generateSkillHealthReport,
    formatSkillHealthReport,
    formatSkillDetail,
  } = await import("./skill-health.js");

  const basePath = projectRoot();

  // /gsd skill-health <skill-name> — detail view
  if (args && !args.startsWith("--")) {
    const detail = formatSkillDetail(basePath, args);
    ctx.ui.notify(detail, "info");
    return;
  }

  // Parse flags
  const staleMatch = args.match(/--stale\s+(\d+)/);
  const staleDays = staleMatch ? parseInt(staleMatch[1], 10) : undefined;
  const decliningOnly = args.includes("--declining");

  const report = generateSkillHealthReport(basePath, staleDays);

  if (decliningOnly) {
    if (report.decliningSkills.length === 0) {
      ctx.ui.notify("Не найдено skills с признаками ухудшения качества.", "info");
      return;
    }
    const filtered = {
      ...report,
      skills: report.skills.filter(s => s.flagged),
    };
    ctx.ui.notify(formatSkillHealthReport(filtered), "info");
    return;
  }

  ctx.ui.notify(formatSkillHealthReport(report), "info");
}

export async function handleCapture(args: string, ctx: ExtensionCommandContext): Promise<void> {
  // Strip surrounding quotes from the argument
  let text = args.trim();
  if (!text) {
    ctx.ui.notify('Использование: /gsd capture "your thought here"', "warning");
    return;
  }
  // Remove wrapping quotes (single or double)
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1);
  }
  if (!text) {
    ctx.ui.notify('Использование: /gsd capture "your thought here"', "warning");
    return;
  }

  const basePath = process.cwd();

  // Ensure .gsd/ exists — capture should work even without a milestone
  const gsdDir = gsdRoot(basePath);
  if (!existsSync(gsdDir)) {
    mkdirSync(gsdDir, { recursive: true });
  }

  const id = appendCapture(basePath, text);
  ctx.ui.notify(`Захвачено: ${id} — "${text.length > 60 ? text.slice(0, 57) + "..." : text}"`, "info");
}

export async function handleTriage(ctx: ExtensionCommandContext, pi: ExtensionAPI, basePath: string): Promise<void> {
  if (!hasPendingCaptures(basePath)) {
    ctx.ui.notify("Нет ожидающих captures для triage.", "info");
    return;
  }

  const pending = loadPendingCaptures(basePath);
  ctx.ui.notify(`Выполняется triage для ${pending.length} capture${pending.length === 1 ? "" : "s"}...`, "info");

  // Build context for the triage prompt
  const state = await deriveState(basePath);
  let currentPlan = "";
  let roadmapContext = "";

  if (state.activeMilestone && state.activeSlice) {
    const { resolveSliceFile, resolveMilestoneFile } = await import("./paths.js");
    const planFile = resolveSliceFile(basePath, state.activeMilestone.id, state.activeSlice.id, "PLAN");
    if (planFile) {
      const { loadFile: load } = await import("./files.js");
      currentPlan = (await load(planFile)) ?? "";
    }
    const roadmapFile = resolveMilestoneFile(basePath, state.activeMilestone.id, "ROADMAP");
    if (roadmapFile) {
      const { loadFile: load } = await import("./files.js");
      roadmapContext = (await load(roadmapFile)) ?? "";
    }
  }

  // Format pending captures for the prompt
  const capturesList = pending.map(c =>
    `- **${c.id}**: "${c.text}" (captured: ${c.timestamp})`
  ).join("\n");

  // Dispatch triage prompt
  const { loadPrompt: loadTriagePrompt } = await import("./prompt-loader.js");
  const prompt = loadTriagePrompt("triage-captures", {
    pendingCaptures: capturesList,
    currentPlan: currentPlan || "(no active slice plan)",
    roadmapContext: roadmapContext || "(no active roadmap)",
  });

  const workflowPath = process.env.GSD_WORKFLOW_PATH ?? join(process.env.HOME ?? "~", ".pi", "GSD-WORKFLOW.md");
  const workflow = readFileSync(workflowPath, "utf-8");

  pi.sendMessage(
    {
      customType: "gsd-triage",
      content: `Read the following GSD workflow protocol and execute exactly.\n\n${workflow}\n\n## Your Task\n\n${prompt}`,
      display: false,
    },
    { triggerTurn: true },
  );
}

export async function handleSteer(change: string, ctx: ExtensionCommandContext, pi: ExtensionAPI): Promise<void> {
  const basePath = process.cwd();
  const state = await deriveState(basePath);
  const mid = state.activeMilestone?.id ?? "none";
  const sid = state.activeSlice?.id ?? "none";
  const tid = state.activeTask?.id ?? "none";
  const appliedAt = `${mid}/${sid}/${tid}`;
  await appendOverride(basePath, change, appliedAt);

  if (isAutoActive()) {
    pi.sendMessage({
      customType: "gsd-hard-steer",
      content: [
        "HARD STEER — User override registered.",
        "",
        `**Override:** ${change}`,
        "",
        "This override has been saved to `.gsd/OVERRIDES.md` and will be injected into all future task prompts.",
        "A document rewrite unit will run before the next task to propagate this change across all active plan documents.",
        "",
        "If you are mid-task, finish your current work respecting this override. The next dispatched unit will be a document rewrite.",
      ].join("\n"),
      display: false,
    }, { triggerTurn: true });
    ctx.ui.notify(`Override зарегистрирован: "${change}". Будет применён перед следующим dispatch задачи.`, "info");
  } else {
    pi.sendMessage({
      customType: "gsd-hard-steer",
      content: [
        "HARD STEER — User override registered.",
        "",
        `**Override:** ${change}`,
        "",
        "This override has been saved to `.gsd/OVERRIDES.md`.",
        "Before continuing, read `.gsd/OVERRIDES.md` and update the current plan documents to reflect this change.",
        "Focus on: active slice plan, incomplete task plans, and DECISIONS.md.",
      ].join("\n"),
      display: false,
    }, { triggerTurn: true });
    ctx.ui.notify(`Override зарегистрирован: "${change}". Обновите документы плана, чтобы отразить это изменение.`, "info");
  }
}

export async function handleKnowledge(args: string, ctx: ExtensionCommandContext): Promise<void> {
  const parts = args.split(/\s+/);
  const typeArg = parts[0]?.toLowerCase();

  if (!typeArg || !["rule", "pattern", "lesson"].includes(typeArg)) {
    ctx.ui.notify(
      "Использование: /gsd knowledge <rule|pattern|lesson> <description>\nПример: /gsd knowledge rule Use real DB for integration tests",
      "warning",
    );
    return;
  }

  const entryText = parts.slice(1).join(" ").trim();
  if (!entryText) {
    ctx.ui.notify(`Использование: /gsd knowledge ${typeArg} <description>`, "warning");
    return;
  }

  const type = typeArg as "rule" | "pattern" | "lesson";
  const basePath = process.cwd();
  const state = await deriveState(basePath);
  const scope = state.activeMilestone?.id
    ? `${state.activeMilestone.id}${state.activeSlice ? `/${state.activeSlice.id}` : ""}`
    : "global";

  await appendKnowledge(basePath, type, entryText, scope);
  ctx.ui.notify(`Добавлено в KNOWLEDGE.md (${type}): "${entryText}"`, "success");
}

export async function handleRunHook(args: string, ctx: ExtensionCommandContext, pi: ExtensionAPI): Promise<void> {
  const parts = args.trim().split(/\s+/);
  if (parts.length < 3) {
    ctx.ui.notify(`Использование: /gsd run-hook <hook-name> <unit-type> <unit-id>

Типы unit:
  execute-task   - Выполнение задачи (unit-id: M001/S01/T01)
  plan-slice     - Планирование slice (unit-id: M001/S01)
  research-milestone - Исследование milestone (unit-id: M001)
  complete-slice - Завершение slice (unit-id: M001/S01)
  complete-milestone - Завершение milestone (unit-id: M001)

Примеры:
  /gsd run-hook code-review execute-task M001/S01/T01
  /gsd run-hook lint-check plan-slice M001/S01`, "warning");
    return;
  }

  const [hookName, unitType, unitId] = parts;
  const basePath = projectRoot();

  // Import the hook trigger function
  const { triggerHookManually, formatHookStatus, getHookStatus } = await import("./post-unit-hooks.js");
  const { dispatchHookUnit } = await import("./auto.js");

  // Check if the hook exists
  const hooks = getHookStatus();
  const hookExists = hooks.some(h => h.name === hookName);
  if (!hookExists) {
    ctx.ui.notify(`Hook "${hookName}" не найден. Настроенные hooks:\n${formatHookStatus()}`, "error");
    return;
  }

  // Validate unit ID format
  const unitIdPattern = /^M\d{3}\/S\d{2,3}\/T\d{2,3}$/;
  if (!unitIdPattern.test(unitId)) {
    ctx.ui.notify(`Неверный формат unit ID: "${unitId}". Ожидаемый формат: M004/S04/T03`, "warning");
    return;
  }

  // Trigger the hook manually
  const hookUnit = triggerHookManually(hookName, unitType, unitId, basePath);
  if (!hookUnit) {
    ctx.ui.notify(`Не удалось запустить hook "${hookName}". Возможно, hook отключён или не настроен для unit type "${unitType}".`, "error");
    return;
  }

  ctx.ui.notify(`Ручной запуск hook: ${hookName} для ${unitType} ${unitId}`, "info");

  // Dispatch the hook unit directly, bypassing normal pre-dispatch hooks
  const success = await dispatchHookUnit(
    ctx,
    pi,
    hookName,
    unitType,
    unitId,
    hookUnit.prompt,
    hookUnit.model,
    basePath,
  );

  if (!success) {
    ctx.ui.notify("Не удалось отправить hook на выполнение. Возможно, auto-mode был отменён.", "error");
  }
}

// ─── Self-update handler ────────────────────────────────────────────────────

function compareSemverLocal(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] || 0
    const vb = pb[i] || 0
    if (va > vb) return 1
    if (va < vb) return -1
  }
  return 0
}

export async function handleUpdate(ctx: ExtensionCommandContext): Promise<void> {
  const { execSync } = await import("node:child_process");

  const NPM_PACKAGE = "gsd-pi";
  const current = process.env.GSD_VERSION || "0.0.0";

  ctx.ui.notify(`Текущая версия: v${current}\nПроверка реестра npm...`, "info");

  let latest: string;
  try {
    latest = execSync(`npm view ${NPM_PACKAGE} version`, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    ctx.ui.notify("Не удалось обратиться к реестру npm. Проверьте подключение к сети.", "error");
    return;
  }

  if (compareSemverLocal(latest, current) <= 0) {
    ctx.ui.notify(`Уже используется актуальная версия (v${current}).`, "info");
    return;
  }

  ctx.ui.notify(`Обновление: v${current} → v${latest}...`, "info");

  try {
    execSync(`npm install -g ${NPM_PACKAGE}@latest`, {
      stdio: ["ignore", "pipe", "ignore"],
    });
    ctx.ui.notify(
      `Обновлено до v${latest}. Перезапустите сессию GSD, чтобы использовать новую версию.`,
      "info",
    );
  } catch {
    ctx.ui.notify(
      `Обновление не удалось. Попробуйте вручную: npm install -g ${NPM_PACKAGE}@latest`,
      "error",
    );
  }
}
