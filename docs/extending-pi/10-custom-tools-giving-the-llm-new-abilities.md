# Пользовательские инструменты — новые возможности LLM


Инструменты — это самая мощная возможность расширения. Они появляются в системной подсказке LLM, а LLM вызывает их автономно, когда это необходимо.

### Определение инструмента

```typescript
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";

pi.registerTool({
  name: "my_tool",                    // Unique identifier
  label: "My Tool",                   // Display name in TUI
  description: "What this does",      // Shown to LLM in system prompt
  
  // Optional: customize the one-liner in the system prompt's "Available tools" section
  promptSnippet: "List or add items to the project todo list",
  
  // Optional: add bullets to the system prompt's "Guidelines" section when tool is active
  promptGuidelines: [
    "Use this tool for todo planning instead of direct file edits."
  ],
  
  // Parameter schema (MUST use TypeBox)
  parameters: Type.Object({
    action: StringEnum(["list", "add"] as const),  // ⚠️ Use StringEnum, NOT Type.Union/Type.Literal
    text: Type.Optional(Type.String()),
  }),

  // The execution function
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // Check for cancellation
    if (signal?.aborted) {
      return { content: [{ type: "text", text: "Cancelled" }] };
    }

    // Stream progress updates to the UI
    onUpdate?.({
      content: [{ type: "text", text: "Working..." }],
      details: { progress: 50 },
    });

    // Do the work
    const result = await doSomething(params);

    // Return result
    return {
      content: [{ type: "text", text: "Done" }],  // Sent to LLM as context
      details: { data: result },                   // For rendering & state reconstruction
    };
  },

  // Optional: Custom TUI rendering (see Section 14)
  renderCall(args, theme) { ... },
  renderResult(result, options, theme) { ... },
});
```

### ⚠️ Критично: используйте StringEnum

Для строковых параметров перечисления вы **должны** использовать `StringEnum` из `@mariozechner/pi-ai`. `Type.Union([Type.Literal("a"), Type.Literal("b")])` работает ли NOT с API от Google.

```typescript
import { StringEnum } from "@mariozechner/pi-ai";

// ✅ Correct
action: StringEnum(["list", "add", "remove"] as const)

// ❌ Broken with Google
action: Type.Union([Type.Literal("list"), Type.Literal("add")])
```

### Динамическая регистрация инструмента

Инструменты можно зарегистрировать в любой момент — при загрузке, в `session_start`, в обработчиках команд и т. д. Новые инструменты доступны сразу и без `/reload`.

```typescript
pi.on("session_start", async (_event, ctx) => {
  pi.registerTool({ name: "dynamic_tool", ... });
});

pi.registerCommand("add-tool", {
  handler: async (args, ctx) => {
    pi.registerTool({ name: "runtime_tool", ... });
    ctx.ui.notify("Tool registered!", "info");
  },
});
```

### Усечение вывода

**Инструменты MUST обрезают вывод**, чтобы не перегружать контекст LLM. Встроенный лимит — 50 КБ/2000 строк (в зависимости от того, что наступит раньше).

```typescript
import {
  truncateHead, truncateTail, formatSize,
  DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES,
} from "@mariozechner/pi-coding-agent";

async execute(toolCallId, params, signal, onUpdate, ctx) {
  const output = await runCommand();
  const truncation = truncateHead(output, {
    maxLines: DEFAULT_MAX_LINES,
    maxBytes: DEFAULT_MAX_BYTES,
  });

  let result = truncation.content;
  if (truncation.truncated) {
    result += `\n\n[Output truncated: ${truncation.outputLines}/${truncation.totalLines} lines]`;
  }
  return { content: [{ type: "text", text: result }] };
}
```

### Переопределение встроенных инструментов

Зарегистрируйте инструмент с тем же именем, что и встроенный (`read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`), чтобы переопределить его. Ваша реализация **должна точно соответствовать форме результата**, включая тип `details`.

```bash
# Start with no built-in tools, only your extensions
pi --no-tools -e ./my-extension.ts
```

### Удаленное выполнение с помощью подключаемых операций

Встроенные инструменты поддерживают подключаемые операции с SSH, контейнерами и т. д.:

```typescript
import { createReadTool, createBashTool } from "@mariozechner/pi-coding-agent";

const remoteBash = createBashTool(cwd, {
  operations: { execute: (cmd) => sshExec(remote, cmd) }
});

// The bash tool also supports a spawnHook:
const bashTool = createBashTool(cwd, {
  spawnHook: ({ command, cwd, env }) => ({
    command: `source ~/.profile\n${command}`,
    cwd: `/mnt/sandbox${cwd}`,
    env: { ...env, CI: "1" },
  }),
});
```

**Рабочие интерфейсы:** `ReadOperations`, `WriteOperations`, `EditOperations`, `BashOperations`, `LsOperations`, `GrepOperations`, `FindOperations`

---
