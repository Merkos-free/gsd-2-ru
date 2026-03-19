/**
 * GSD Init Wizard — Per-project onboarding.
 *
 * Guides users through project setup when entering a directory without .gsd/.
 * Detects project ecosystem, offers v1 migration, configures project preferences,
 * bootstraps .gsd/ structure, and transitions to the first milestone discussion.
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@gsd/pi-coding-agent";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { showNextAction } from "../shared/mod.js";
import { nativeIsRepo, nativeInit } from "./native-git-bridge.js";
import { ensureGitignore, untrackRuntimeFiles } from "./gitignore.js";
import { gsdRoot } from "./paths.js";
import { assertSafeDirectory } from "./validate-directory.js";
import type { ProjectDetection, ProjectSignals } from "./detection.js";

// ─── Types ──────────────────────────────────────────────────────────────────────

interface InitWizardResult {
  /** Whether the wizard completed (vs cancelled) */
  completed: boolean;
  /** Whether .gsd/ was created */
  bootstrapped: boolean;
}

interface ProjectPreferences {
  mode: "solo" | "team";
  gitIsolation: "worktree" | "branch" | "none";
  mainBranch: string;
  verificationCommands: string[];
  customInstructions: string[];
  tokenProfile: "budget" | "balanced" | "quality";
  skipResearch: boolean;
  autoPush: boolean;
}

// ─── Defaults ───────────────────────────────────────────────────────────────────

const DEFAULT_PREFS: ProjectPreferences = {
  mode: "solo",
  gitIsolation: "worktree",
  mainBranch: "main",
  verificationCommands: [],
  customInstructions: [],
  tokenProfile: "balanced",
  skipResearch: false,
  autoPush: true,
};

// ─── Main Wizard ────────────────────────────────────────────────────────────────

/**
 * Run the project init wizard.
 * Called when entering a directory without .gsd/ (or via /gsd init).
 */
export async function showProjectInit(
  ctx: ExtensionCommandContext,
  pi: ExtensionAPI,
  basePath: string,
  detection: ProjectDetection,
): Promise<InitWizardResult> {
  const signals = detection.projectSignals;
  const prefs = { ...DEFAULT_PREFS };

  // ── Step 1: Show what we detected ──────────────────────────────────────────
  const detectionSummary = buildDetectionSummary(signals);
  if (detectionSummary.length > 0) {
    ctx.ui.notify(`Обнаружен проект:\n${detectionSummary.join("\n")}`, "info");
  }

  // ── Step 2: Git setup ──────────────────────────────────────────────────────
  if (!signals.isGitRepo) {
    const gitChoice = await showNextAction(ctx, {
      title: "GSD — Project Setup",
      summary: ["Эта папка не является git-репозиторием. GSD использует git для контроля версий и изоляции."],
      actions: [
        { id: "init_git", label: "Инициализировать git", description: "Создать git-репозиторий в этой папке", recommended: true },
        { id: "skip_git", label: "Пропустить", description: "Продолжить без git (ограниченная функциональность)" },
      ],
      notYetMessage: "Запустите /gsd init, когда будете готовы.",
    });

    if (gitChoice === "not_yet") return { completed: false, bootstrapped: false };

    if (gitChoice === "init_git") {
      nativeInit(basePath, prefs.mainBranch);
    }
  } else {
    // Auto-detect main branch from existing repo
    const detectedBranch = detectMainBranch(basePath);
    if (detectedBranch) prefs.mainBranch = detectedBranch;
  }

  // ── Step 3: Mode selection ─────────────────────────────────────────────────
  const modeChoice = await showNextAction(ctx, {
    title: "GSD — Workflow Mode",
    summary: ["Как вы работаете над этим проектом?"],
    actions: [
      {
        id: "solo",
        label: "Самостоятельно",
        description: "Только я — auto-push, squash merge, изоляция через worktree",
        recommended: true,
      },
      {
        id: "team",
        label: "Команда",
        description: "Несколько участников — workflow на ветках, удобный для PR",
      },
    ],
    notYetMessage: "Запустите /gsd init, когда будете готовы.",
  });

  if (modeChoice === "not_yet") return { completed: false, bootstrapped: false };
  prefs.mode = modeChoice as "solo" | "team";

  // Apply mode-driven defaults
  if (prefs.mode === "team") {
    prefs.autoPush = false;
  }

  // ── Step 4: Verification commands ──────────────────────────────────────────
  prefs.verificationCommands = signals.verificationCommands;

  if (signals.verificationCommands.length > 0) {
    const verifyLines = signals.verificationCommands.map((cmd, i) => `  ${i + 1}. ${cmd}`);
    const verifyChoice = await showNextAction(ctx, {
      title: "GSD — Verification Commands",
      summary: [
        "Автоматически обнаружены команды проверки:",
        ...verifyLines,
        "",
        "GSD запускает их после каждого изменения кода, чтобы убедиться, что ничего не сломано.",
      ],
      actions: [
        { id: "accept", label: "Использовать эти команды", description: "Принять автоматически найденные команды", recommended: true },
        { id: "skip", label: "Пропустить проверку", description: "Не запускать проверку после изменений" },
      ],
      notYetMessage: "Запустите /gsd init, когда будете готовы.",
    });

    if (verifyChoice === "not_yet") return { completed: false, bootstrapped: false };
    if (verifyChoice === "skip") prefs.verificationCommands = [];
  }

  // ── Step 5: Git preferences ────────────────────────────────────────────────
  const gitSummary: string[] = [];
  gitSummary.push(`Git isolation: worktree`);
  gitSummary.push(`Main branch: ${prefs.mainBranch}`);

  const gitChoice = await showNextAction(ctx, {
    title: "GSD — Git Settings",
    summary: ["Настройки git по умолчанию для этого проекта:", ...gitSummary],
    actions: [
      { id: "accept", label: "Принять значения по умолчанию", description: "Использовать стандартные настройки git", recommended: true },
      { id: "customize", label: "Настроить", description: "Изменить настройки git" },
    ],
    notYetMessage: "Запустите /gsd init, когда будете готовы.",
  });

  if (gitChoice === "not_yet") return { completed: false, bootstrapped: false };

  if (gitChoice === "customize") {
    await customizeGitPrefs(ctx, prefs, signals);
  }

  // ── Step 6: Custom instructions ────────────────────────────────────────────
  const instructionChoice = await showNextAction(ctx, {
    title: "GSD — Project Instructions",
    summary: [
      "Есть ли правила, которым GSD должен следовать в этом проекте?",
      "",
      "Примеры:",
      '  - "Use TypeScript strict mode"',
      '  - "Always write tests for new code"',
      '  - "This is a monorepo, only touch packages/api"',
      "",
      "Позже вы всегда сможете добавить больше через /gsd prefs project.",
    ],
    actions: [
      { id: "skip", label: "Пока пропустить", description: "Без специальных инструкций", recommended: true },
      { id: "add", label: "Добавить инструкции", description: "Ввести правила проекта" },
    ],
    notYetMessage: "Запустите /gsd init, когда будете готовы.",
  });

  if (instructionChoice === "not_yet") return { completed: false, bootstrapped: false };

  if (instructionChoice === "add") {
    const input = await ctx.ui.input(
      "Введите инструкции (по одной на строку или через запятую):",
      "например, Use Tailwind CSS, Always write tests",
    );
    if (input && input.trim()) {
      // Split on newlines or commas
      prefs.customInstructions = input
        .split(/[,\n]/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
    }
  }

  // ── Step 7: Advanced (optional) ────────────────────────────────────────────
  const advancedChoice = await showNextAction(ctx, {
    title: "GSD — Advanced Settings",
    summary: [
      `Token profile: ${prefs.tokenProfile}`,
      `Пропустить фазу исследования: ${prefs.skipResearch ? "да" : "нет"}`,
      `Auto-push при merge: ${prefs.autoPush ? "да" : "нет"}`,
    ],
    actions: [
      { id: "accept", label: "Принять значения по умолчанию", description: "Использовать стандартные настройки", recommended: true },
      { id: "customize", label: "Настроить", description: "Изменить дополнительные параметры" },
    ],
    notYetMessage: "Запустите /gsd init, когда будете готовы.",
  });

  if (advancedChoice === "not_yet") return { completed: false, bootstrapped: false };

  if (advancedChoice === "customize") {
    await customizeAdvancedPrefs(ctx, prefs);
  }

  // ── Step 8: Bootstrap .gsd/ ────────────────────────────────────────────────
  bootstrapGsdDirectory(basePath, prefs, signals);

  // Ensure .gitignore
  ensureGitignore(basePath);
  untrackRuntimeFiles(basePath);

  ctx.ui.notify("GSD инициализирован. Запускается первый milestone...", "info");

  return { completed: true, bootstrapped: true };
}

// ─── V1 Migration Offer ─────────────────────────────────────────────────────────

/**
 * Show migration offer when .planning/ is detected.
 * Returns 'migrate', 'fresh', or 'cancel'.
 */
export async function offerMigration(
  ctx: ExtensionCommandContext,
  v1: NonNullable<ProjectDetection["v1"]>,
): Promise<"migrate" | "fresh" | "cancel"> {
  const summary = [
    "Найдена директория .planning/ (формат GSD v1)",
  ];
  if (v1.phaseCount > 0) {
    summary.push(`Обнаружено ${v1.phaseCount} phase${v1.phaseCount > 1 ? "s" : ""}`);
  }
  if (v1.hasRoadmap) {
    summary.push("Есть ROADMAP.md");
  }

  const choice = await showNextAction(ctx, {
    title: "GSD — Обнаружен legacy-проект",
    summary,
    actions: [
      {
        id: "migrate",
        label: "Мигрировать на GSD v2",
        description: "Преобразовать .planning/ в формат .gsd/",
        recommended: true,
      },
      {
        id: "fresh",
        label: "Начать с нуля",
        description: "Игнорировать .planning/ и создать новый .gsd/",
      },
    ],
    notYetMessage: "Запустите /gsd init, когда будете готовы.",
  });

  if (choice === "not_yet") return "cancel";
  return choice as "migrate" | "fresh";
}

// ─── Re-init Handler ────────────────────────────────────────────────────────────

/**
 * Handle /gsd init when .gsd/ already exists.
 * Offers preference reset without destructive milestone deletion.
 */
export async function handleReinit(
  ctx: ExtensionCommandContext,
  detection: ProjectDetection,
): Promise<void> {
  const summary = ["GSD уже инициализирован в этом проекте."];
  if (detection.v2) {
    summary.push(`Найдено milestone: ${detection.v2.milestoneCount}`);
    summary.push(`Настройки: ${detection.v2.hasPreferences ? "заданы" : "не заданы"}`);
  }

  const choice = await showNextAction(ctx, {
    title: "GSD — Уже инициализирован",
    summary,
    actions: [
      {
        id: "prefs",
        label: "Перенастроить preferences",
        description: "Обновить настройки проекта без изменения milestones",
        recommended: true,
      },
      {
        id: "cancel",
        label: "Отмена",
        description: "Оставить всё как есть",
      },
    ],
    notYetMessage: "Запустите /gsd init, когда будете готовы.",
  });

  if (choice === "prefs") {
    ctx.ui.notify("Используйте /gsd prefs project, чтобы обновить настройки проекта.", "info");
  }
}

// ─── Git Preferences Customization ──────────────────────────────────────────────

async function customizeGitPrefs(
  ctx: ExtensionCommandContext,
  prefs: ProjectPreferences,
  signals: ProjectSignals,
): Promise<void> {
  // Isolation strategy
  const hasSubmodules = existsSync(join(process.cwd(), ".gitmodules"));
  const isolationActions = [
    { id: "worktree", label: "Worktree", description: "Изолированный git worktree для каждого milestone (рекомендуется)", recommended: !hasSubmodules },
    { id: "branch", label: "Ветка", description: "Работа в ветках из корня проекта (лучше для submodules)", recommended: hasSubmodules },
    { id: "none", label: "Без изоляции", description: "Без изоляции — коммиты в текущую ветку" },
  ];

  const isolationSummary = hasSubmodules
    ? ["Обнаружены submodules — режим branch предпочтительнее worktree."]
    : ["Изоляция через worktree создаёт отдельную копию для каждого milestone."];

  const isolationChoice = await showNextAction(ctx, {
    title: "Стратегия git-изоляции",
    summary: isolationSummary,
    actions: isolationActions,
  });
  if (isolationChoice !== "not_yet") {
    prefs.gitIsolation = isolationChoice as "worktree" | "branch" | "none";
  }
}

// ─── Advanced Preferences Customization ─────────────────────────────────────────

async function customizeAdvancedPrefs(
  ctx: ExtensionCommandContext,
  prefs: ProjectPreferences,
): Promise<void> {
  // Token profile
  const profileChoice = await showNextAction(ctx, {
    title: "Профиль использования токенов",
    summary: [
      "Определяет, сколько контекста GSD использует на задачу.",
      "Экономный режим: дешевле и быстрее. Качественный: тщательнее, но дороже.",
    ],
    actions: [
      { id: "balanced", label: "Сбалансированный", description: "Хороший компромисс (по умолчанию)", recommended: true },
      { id: "budget", label: "Экономный", description: "Минимизировать использование токенов" },
      { id: "quality", label: "Качественный", description: "Максимальная тщательность" },
    ],
  });
  if (profileChoice !== "not_yet") {
    prefs.tokenProfile = profileChoice as "budget" | "balanced" | "quality";
  }

  // Skip research
  const researchChoice = await showNextAction(ctx, {
    title: "Фаза исследования",
    summary: [
      "GSD может исследовать кодовую базу перед планированием каждого milestone.",
      "Небольшим проектам этот шаг может не понадобиться.",
    ],
    actions: [
      { id: "keep", label: "Оставить исследование", description: "Изучать кодовую базу перед планированием", recommended: true },
      { id: "skip", label: "Пропустить исследование", description: "Сразу перейти к планированию" },
    ],
  });
  prefs.skipResearch = researchChoice === "skip";

  // Auto-push
  const pushChoice = await showNextAction(ctx, {
    title: "Auto-push после merge",
    summary: [
      "Выполнять auto-push в remote после merge ветки milestone?",
      prefs.mode === "team"
        ? "Режим team: обычно отключено, чтобы изменения проходили через PR review."
        : "Режим solo: обычно включено для удобства.",
    ],
    actions: [
      { id: "yes", label: "Да", description: "Отправлять автоматически", recommended: prefs.mode === "solo" },
      { id: "no", label: "Нет", description: "Только ручной push", recommended: prefs.mode === "team" },
    ],
  });
  prefs.autoPush = pushChoice !== "no";
}

// ─── Bootstrap ──────────────────────────────────────────────────────────────────

function bootstrapGsdDirectory(
  basePath: string,
  prefs: ProjectPreferences,
  signals: ProjectSignals,
): void {
  // Final safety check before writing any files
  assertSafeDirectory(basePath);

  const gsd = gsdRoot(basePath);
  mkdirSync(join(gsd, "milestones"), { recursive: true });

  // Write preferences.md from wizard answers
  const preferencesContent = buildPreferencesFile(prefs);
  writeFileSync(join(gsd, "preferences.md"), preferencesContent, "utf-8");

  // Seed CONTEXT.md with detected project signals
  const contextContent = buildContextSeed(signals);
  if (contextContent) {
    writeFileSync(join(gsd, "CONTEXT.md"), contextContent, "utf-8");
  }
}

function buildPreferencesFile(prefs: ProjectPreferences): string {
  const lines: string[] = ["---"];
  lines.push("version: 1");
  lines.push(`mode: ${prefs.mode}`);

  // Git preferences
  lines.push("git:");
  lines.push(`  isolation: ${prefs.gitIsolation}`);
  lines.push(`  main_branch: ${prefs.mainBranch}`);
  lines.push(`  auto_push: ${prefs.autoPush}`);

  // Verification commands
  if (prefs.verificationCommands.length > 0) {
    lines.push("verification_commands:");
    for (const cmd of prefs.verificationCommands) {
      lines.push(`  - "${cmd}"`);
    }
  }

  // Custom instructions
  if (prefs.customInstructions.length > 0) {
    lines.push("custom_instructions:");
    for (const inst of prefs.customInstructions) {
      lines.push(`  - "${inst.replace(/"/g, '\\"')}"`);
    }
  }

  // Token profile (only if non-default)
  if (prefs.tokenProfile !== "balanced") {
    lines.push(`token_profile: ${prefs.tokenProfile}`);
  }

  // Phase skips
  if (prefs.skipResearch) {
    lines.push("phases:");
    lines.push("  skip_research: true");
  }

  // Defaults for wizard-generated files
  lines.push("always_use_skills: []");
  lines.push("prefer_skills: []");
  lines.push("avoid_skills: []");
  lines.push("skill_rules: []");

  lines.push("---");
  lines.push("");
  lines.push("# GSD Project Preferences");
  lines.push("");
  lines.push("Сгенерировано командой `/gsd init`. Можно редактировать напрямую или менять через `/gsd prefs project`.");
  lines.push("");
  lines.push("Полная документация по полям: `~/.gsd/agent/extensions/gsd/docs/preferences-reference.md`.");
  lines.push("");

  return lines.join("\n");
}

function buildContextSeed(signals: ProjectSignals): string | null {
  const lines: string[] = [];

  if (signals.detectedFiles.length === 0 && !signals.isGitRepo) {
    return null; // Empty folder, no context to seed
  }

  lines.push("# Project Context");
  lines.push("");
  lines.push("Автоматически определено мастером инициализации GSD. При необходимости отредактируйте или расширьте.");
  lines.push("");

  if (signals.primaryLanguage) {
    lines.push(`## Language / Stack`);
    lines.push("");
    lines.push(`Primary: ${signals.primaryLanguage}`);
    if (signals.isMonorepo) {
      lines.push("Structure: monorepo");
    }
    lines.push("");
  }

  if (signals.detectedFiles.length > 0) {
    lines.push("## Project Files");
    lines.push("");
    for (const f of signals.detectedFiles) {
      lines.push(`- ${f}`);
    }
    lines.push("");
  }

  if (signals.hasCI) {
    lines.push("## CI/CD");
    lines.push("");
    lines.push("Обнаружена конфигурация CI.");
    lines.push("");
  }

  if (signals.hasTests) {
    lines.push("## Testing");
    lines.push("");
    lines.push("Обнаружена тестовая инфраструктура.");
    if (signals.verificationCommands.length > 0) {
      lines.push("");
      lines.push("Команды проверки:");
      for (const cmd of signals.verificationCommands) {
        lines.push(`- \`${cmd}\``);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function buildDetectionSummary(signals: ProjectSignals): string[] {
  const lines: string[] = [];

  if (signals.primaryLanguage) {
    const typeStr = signals.isMonorepo ? "monorepo" : "project";
    lines.push(`  ${signals.primaryLanguage} ${typeStr}`);
  }

  if (signals.detectedFiles.length > 0) {
    lines.push(`  Файлы проекта: ${signals.detectedFiles.join(", ")}`);
  }

  if (signals.packageManager) {
    lines.push(`  Менеджер пакетов: ${signals.packageManager}`);
  }

  if (signals.hasCI) lines.push("  CI/CD: обнаружено");
  if (signals.hasTests) lines.push("  Tests: обнаружены");

  if (signals.verificationCommands.length > 0) {
    lines.push(`  Проверка: ${signals.verificationCommands.join(", ")}`);
  }

  return lines;
}

function detectMainBranch(basePath: string): string | null {
  try {
    // Check HEAD reference for common branch names
    const headPath = join(basePath, ".git", "HEAD");
    if (existsSync(headPath)) {
      const head = readFileSync(headPath, "utf-8").trim();
      const match = head.match(/^ref: refs\/heads\/(.+)$/);
      if (match) return match[1];
    }

    // Check for common remote branches
    const refsPath = join(basePath, ".git", "refs", "remotes", "origin");
    if (existsSync(refsPath)) {
      if (existsSync(join(refsPath, "main"))) return "main";
      if (existsSync(join(refsPath, "master"))) return "master";
    }
  } catch {
    // Fall through to null
  }
  return null;
}
