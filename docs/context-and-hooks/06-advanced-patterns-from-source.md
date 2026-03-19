# Расширенные шаблоны из исходного кода

Производственные шаблоны, извлеченные из базы кода pi, встроенных расширений и реальных примеров расширений. Каждый шаблон показывает механизм, источник истины и время его использования.

---

## Шаблон 1: наборы инструментов с учетом режима и внедрением контекста

**Источник:** `plan-mode/index.ts` — встроенное расширение режима планирования.

Этот шаблон сочетает в себе управление набором инструментов, блокировку вызовов инструментов, фильтрацию контекстных событий и внедрение before_agent_start в систему связного режима.

### Архитектура

```
/plan toggle → sets planModeEnabled
  ├─► setActiveTools(PLAN_MODE_TOOLS)     # restrict available tools
  ├─► tool_call guard                      # block unsafe bash even if tool is active
  ├─► before_agent_start                   # inject mode-specific instructions
  ├─► context                              # filter stale mode messages on mode exit
  └─► agent_end                            # check plan output, offer execution
```

### Ключевая идея: Глубокоэшелонированная защита

В режиме плана используется THREE уровней управления инструментом:

1. **`setActiveTools`** — полностью удаляет инструменты записи из активного набора. LLM даже не знает об их существовании.
2. **`tool_call` Guard** — даже для разрешенных инструментов, таких как `bash`, блокирует деструктивные команды через список разрешений.
3. **Фильтр `context`** — при выходе из режима плана удаляет устаревшие контекстные сообщения режима плана, чтобы они не путали LLM в обычном режиме.

```typescript
// Layer 1: Tool set
if (planModeEnabled) {
  pi.setActiveTools(["read", "bash", "grep", "find", "ls"]);
}

// Layer 2: Bash guard  
pi.on("tool_call", async (event) => {
  if (!planModeEnabled || event.toolName !== "bash") return;
  if (!isSafeCommand(event.input.command)) {
    return { block: true, reason: "Plan mode: command blocked" };
  }
});

// Layer 3: Context cleanup on mode exit
pi.on("context", async (event) => {
  if (planModeEnabled) return; // keep plan context when in plan mode
  return {
    messages: event.messages.filter(m => {
      // Remove plan mode markers from context
      if (m.customType === "plan-mode-context") return false;
      return true;
    }),
  };
});
```

### Почему это важно

Наивная реализация просто изменила бы набор инструментов. Но:
- `bash` с `rm -rf` технически является инструментом «только для чтения» по названию.
- Устаревшие контекстные сообщения из предыдущего режима могут сбить с толку LLM.
- LLM может попытаться обойти ограничения, если он видит инструкции по режиму, но имеет доступные инструменты.

---

## Схема 2: предустановленная система с динамической моделью + инструментом + подсказкой конфигурации

**Источник:** `preset.ts` — встроенное расширение пресета.

Этот шаблон показывает, как создать полную систему управления конфигурацией, которая координирует модель, уровень мышления, инструменты и системные подсказки из одного файла конфигурации.

### Архитектура

```
presets.json → load on session_start
  │
  ├─► /preset command      → applyPreset(name)
  ├─► Ctrl+Shift+U         → cyclePreset()
  ├─► --preset flag         → applyPreset on startup
  │
  applyPreset:
  ├─► pi.setModel()         → switch model
  ├─► pi.setThinkingLevel() → adjust thinking
  ├─► pi.setActiveTools()   → reconfigure tools
  └─► store activePreset    → before_agent_start reads it
  
  before_agent_start:
  └─► append preset.instructions to system prompt
```

### Ключевая информация: приложение с отложенным системным приглашением

Предустановка не изменяет системное приглашение во время `applyPreset`. Он сохраняет `activePreset` и позволяет `before_agent_start` прочитать его:

```typescript
// On apply — just store
activePresetName = name;
activePreset = preset;

// On each prompt — inject
pi.on("before_agent_start", async (event) => {
  if (activePreset?.instructions) {
    return {
      systemPrompt: `${event.systemPrompt}\n\n${activePreset.instructions}`,
    };
  }
});
```

Это лучше, чем прямой вызов `agent.setSystemPrompt()`, потому что:
- `before_agent_start` срабатывает при каждом запросе, сохраняя актуальность системного запроса.
- Подсказка базовой системы перестраивается с помощью pi при смене инструментов — прямой набор будет перезаписан.
- Другие расширения могут видеть и изменять подсказку в цепочке.

---

## Шаблон 3: отслеживание прогресса с помощью виджета + сохранение состояния

**Источник:** `plan-mode/index.ts` — отслеживание задач во время выполнения плана.

### Архитектура

```
Plan created (assistant message with "Plan:" section)
  → extractTodoItems() parses numbered steps
  → todoItems stored in memory
  → ui.setWidget() shows progress
  → appendEntry() persists state
  
Each turn:
  → turn_end checks for [DONE:n] markers
  → markCompletedSteps() updates todoItems
  → updateStatus() refreshes widget
  
Session resume:
  → session_start restores from appendEntry
  → Re-scans messages after last execute marker for [DONE:n]
  → Rebuilds completion state
```

### Ключевая идея: реконструкция двойного государства

При возобновлении сеанса расширение выполняет действия TWO:

1. **Читает сохраненное состояние** из `appendEntry`:
   ```typescript
   const planModeEntry = entries
     .filter(e => e.type === "custom" && e.customType === "plan-mode")
     .pop();
   ```

2. **Повторно сканирует сообщения помощника** на наличие маркеров завершения:
   ```typescript
   // Only scan messages AFTER the last plan-mode-execute marker
   const allText = messages.map(getTextContent).join("\n");
   markCompletedSteps(allText, todoItems);
   ```

Это обрабатывает случай, когда расширение вышло из строя или было перезагружено в середине выполнения — сохраненное состояние может быть устаревшим, но сообщения являются источником истины.

---

## Шаблон 4: Динамическое внедрение ресурсов

**Источник:** `dynamic-resources/index.ts` — расширение со своими собственными навыками и темами.

```typescript
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const baseDir = dirname(fileURLToPath(import.meta.url));

export default function (pi: ExtensionAPI) {
  pi.on("resources_discover", () => {
    return {
      skillPaths: [join(baseDir, "SKILL.md")],
      promptPaths: [join(baseDir, "dynamic.md")],
      themePaths: [join(baseDir, "dynamic.json")],
    };
  });
}
```

### Как это работает внутри

После `session_start` бегун называет `emitResourcesDiscover()`. Возвращенные пути обрабатываются через `ResourceLoader`:

1. Навыки → загружено, добавлено в список навыков в системной подсказке.
2. Подсказки → загружаются как шаблоны подсказок, доступные через `/templatename`.
3. Темы → загружены, доступны через `/theme` или `ctx.ui.setTheme()`.

Системная подсказка перестраивается после расширения ресурсов, поэтому новые навыки появляются в одном и том же ходу подсказки.

### Когда использовать

- Пакеты расширений, требующие специальных навыков (например, расширение развертывания с навыком «контрольный список развертывания»).
- Пакеты тем распространяются как расширения.
- Динамические шаблоны подсказок, которые зависят от контекста проекта.

---

## Шаблон 5: Интеграция правил Клода

**Источник:** `claude-rules.ts` — сканирование `.claude/rules/` для поиска правил для каждого проекта.

### Архитектура

```
session_start:
  → Scan .claude/rules/ for .md files (recursive)
  → Store file list

before_agent_start:
  → Append file list to system prompt
  → Agent uses read tool to load specific rules on demand
```

### Ключевая информация: листинг, а не загрузка

Расширение NOT загружает содержимое файла правил в системную подсказку. В нем перечислены файлы:

```typescript
pi.on("before_agent_start", async (event) => {
  if (ruleFiles.length === 0) return;
  
  const rulesList = ruleFiles.map(f => `- .claude/rules/${f}`).join("\n");
  
  return {
    systemPrompt: event.systemPrompt + `

## Project Rules
The following project rules are available in .claude/rules/:
${rulesList}
When working on tasks related to these rules, use the read tool to load the relevant rule files.`,
  };
});
```

Это контекстно-эффективно: системное приглашение увеличивается на одну строку для каждого файла правил, а не на полное содержимое каждого правила. LLM загружает определенные правила через `read` только при необходимости.

---

## Шаблон 6: Удаленное выполнение с помощью упаковки инструментов

**Источник:** Шаблон расширения SSH и `createBashTool` с подключаемыми операциями.

### Архитектура

Инструменты поддерживают подключаемые модули `operations`, которые заменяют базовый ввод-вывод:

```typescript
import { createBashTool } from "@mariozechner/pi-coding-agent";

// Create a bash tool that executes via SSH
const remoteBash = createBashTool(cwd, {
  operations: {
    execute: async (command, options) => {
      return sshExec(remoteHost, command, options);
    },
  },
});

// Register it as the bash tool (overrides built-in)
pi.registerTool({
  ...remoteBash,
  name: "bash", // same name = overrides built-in
});
```

### Альтернатива spawnHook

Для более легкой настройки (например, настройки среды):

```typescript
const bashTool = createBashTool(cwd, {
  spawnHook: ({ command, cwd, env }) => ({
    command: `source ~/.profile\n${command}`,
    cwd: `/mnt/sandbox${cwd}`,
    env: { ...env, CI: "1" },
  }),
});
```

### Пользовательский Bash Hook для команд `!`

Событие `user_bash` позволяет перехватывать команды bash, вводимые пользователем (не инициированные LLM):

```typescript
pi.on("user_bash", async (event) => {
  // Route user bash commands through SSH too
  return {
    operations: {
      execute: (cmd, opts) => sshExec(remoteHost, cmd, opts),
    },
  };
});
```

---

## Шаблон 7: Сжатие с учетом расширений

**Источник:** `session_before_compact` в agent-session.ts.

### Сводка пользовательского сжатия

Переопределить сводку, созданную по умолчанию LLM:

```typescript
pi.on("session_before_compact", async (event) => {
  // Build a domain-specific summary
  const summary = buildCustomSummary(event.branchEntries);
  
  return {
    compaction: {
      summary,
      firstKeptEntryId: event.preparation.firstKeptEntryId,
      tokensBefore: event.preparation.tokensBefore,
    },
  };
});
```

### Состояние с учетом сжатия

Если ваше расширение хранит состояние в сообщениях, которые могут быть сжаты, вам нужна стратегия реконструкции:

```typescript
pi.on("session_start", async (_event, ctx) => {
  // Check if there's been a compaction
  const entries = ctx.sessionManager.getBranch();
  const hasCompaction = entries.some(e => e.type === "compaction");
  
  if (hasCompaction) {
    // State before compaction is gone from messages
    // Fall back to appendEntry data or re-derive from remaining messages
    restoreFromAppendEntries(entries);
  } else {
    // Full message history available
    restoreFromToolResults(entries);
  }
});
```

---

## Шаблон 8: Полная последовательность инициализации расширения

Из исходного кода полный порядок инициализации:

```
1. Extension factory function runs
   ├─► pi.on() — register event handlers
   ├─► pi.registerTool() — register tools
   ├─► pi.registerCommand() — register commands
   ├─► pi.registerShortcut() — register shortcuts
   ├─► pi.registerFlag() — register CLI flags
   └─► pi.registerProvider() — queued (not yet applied)

2. ExtensionRunner created with all extensions

3. bindCore() — action methods become live
   ├─► pi.sendMessage, pi.setActiveTools, etc. now work
   └─► Queued provider registrations flushed to ModelRegistry

4. bindExtensions() — UI context and command context connected
   └─► setUIContext(), bindCommandContext()

5. session_start event fires
   └─► Extensions restore state from session

6. resources_discover event fires
   └─► Extensions provide additional skill/prompt/theme paths

7. System prompt rebuilt with new resources

8. Ready for first user prompt
```

**Важный момент:** На шаге 1 будут выдаваться методы действия (`sendMessage`, `setActiveTools` и т. д.). Регистрировать обработчики и инструменты можно только во время фабричной функции. Используйте `session_start` для всего, что требует доступа во время выполнения.
