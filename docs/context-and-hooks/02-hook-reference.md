# Ссылка на крючок

Полная спецификация поведения каждого хука в системе расширения pi. Охватывает время, семантику цепочки, формы возврата и крайние случаи, которых нет в документации по расширению Pi.

---

## Категории крючков

1. **Перехватчики ввода** — перехватывают ввод пользователя до того, как агент
2. **Перехватчики жизненного цикла агента** — контролируйте границы цикла агента.
3. **Пошаговые перехваты** — срабатывание при каждом вызове LLM в рамках сеанса агента.
4. **Перехваты инструментов** — перехват выполнения отдельных инструментов.
5. **Перехватчики сеансов** — реагирование на изменения жизненного цикла сеанса.
6. **Привязка модели** — реакция на изменения модели.
7. **Перехватчики ресурсов** — предоставление динамических ресурсов при запуске.

---

## 1. Хуки ввода

### `input`

**Когда:** Пользователь отправляет текст (введите в редакторе, введите сообщение RPC или `pi.sendUserMessage` из расширения с помощью `source: "extension"`).

**До:** Расширение навыков, расширение шаблонов, проверка команд (команды расширения проверяются до срабатывания `input`, а встроенные команды проверяются после).

**Цепочка:** последовательно для всех расширений. Каждый обработчик видит текстовый вывод `transform` предыдущего обработчика. Сначала `handled` останавливает цепь и трубопровод.

```typescript
pi.on("input", async (event, ctx) => {
  // event.text: string — current text (possibly transformed by earlier handler)
  // event.images: ImageContent[] | undefined
  // event.source: "interactive" | "rpc" | "extension"
  
  // Option 1: Pass through
  return { action: "continue" };
  // or return nothing (undefined) — same as continue
  
  // Option 2: Transform
  return { action: "transform", text: "rewritten", images: newImages };
  
  // Option 3: Swallow (no LLM call, no further handlers)
  return { action: "handled" };
});
```

** Краевые случаи: **
- Команды расширения (`/mycommand`) проверяются **до** срабатывания `input`. Если оно соответствует, `input` никогда не сработает.
- Встроенные команды (`/new`, `/model` и т. д.) проверяются **после** преобразований `input`. Таким образом, `input` может преобразовать текст во встроенную команду или преобразовать встроенную команду во что-то другое.
- Изображения можно заменить с помощью `transform`. Если пропустить `images` в результате преобразования, исходные изображения будут сохранены.

---

## 2. Перехватчики жизненного цикла агента

### `before_agent_start`

**Когда:** После обработки ввода, расширения навыка/шаблона и создания пользовательского сообщения, но до вызова `agent.prompt()`.

**Срабатывает**: один раз по запросу пользователя. Срабатывает ли NOT в последующих ходах одного и того же агента.

**Цепочка:**
- **Системная подсказка:** Цепи. Расширение A изменяет `event.systemPrompt`, расширение B видит эту измененную версию. Если ни одно расширение не возвращает `systemPrompt`, используется базовая подсказка (сбрасывая все изменения предыдущего хода).
- **Сообщения:** Накапливаются. Все результаты `message` собираются в массив. Каждый из них становится отдельным номером `CustomMessage`, а `role: "custom"` добавляется после сообщения пользователя.

```typescript
pi.on("before_agent_start", async (event, ctx) => {
  // event.prompt: string — expanded user prompt text
  // event.images: ImageContent[] | undefined
  // event.systemPrompt: string — current system prompt (may be chained from earlier extension)
  
  return {
    // Optional: inject a custom message into the session
    message: {
      customType: "my-extension",  // identifies the message type
      content: "Text the LLM sees", // string or (TextContent | ImageContent)[]
      display: true,                // controls UI rendering, NOT LLM visibility
      details: { any: "data" },     // for custom rendering and state reconstruction
    },
    
    // Optional: modify the system prompt for this agent run
    systemPrompt: event.systemPrompt + "\nNew instructions",
  };
});
```

**Важная информация.** Поле `display` определяет, будет ли сообщение отображаться в журнале чата TUI. LLM **всегда** видит содержимое сообщения независимо от `display`. Все пользовательские сообщения становятся сообщениями роли `user` в `convertToLlm`.

**Обработка ошибок.** Если обработчик выдает ошибку, ошибка фиксируется и сообщается через `emitError`. Другие обработчики все еще работают. Трубопровод не остановлен.

### `agent_start`

**Когда:** Начинается цикл агента (после `before_agent_start`, после вызова `agent.prompt()`).

**Срабатывает**: один раз для каждого запуска агента. Только для информации — без возвращаемого значения.

```typescript
pi.on("agent_start", async (event, ctx) => {
  // event: { type: "agent_start" }
  // Useful for: starting timers, resetting per-run state
});
```

### `agent_end`

**Когда:** Цикл агента завершается (все ходы завершены, больше нет вызовов инструментов и сообщений в очереди).

**Срабатывает**: один раз для каждого запуска агента.

```typescript
pi.on("agent_end", async (event, ctx) => {
  // event.messages: AgentMessage[] — all messages produced during this run
  // Useful for: final summaries, state persistence, triggering follow-up actions
});
```

**Тонкость:** `event.messages` содержит только сообщения NEW от этого агента, а не полную историю разговоров. Используйте `ctx.sessionManager.getBranch()` для просмотра полной истории.

---

## 3. Поворотные крючки

### `turn_start`

**Когда:** начинается каждый ход в цикле агента (до вызова LLM).

```typescript
pi.on("turn_start", async (event, ctx) => {
  // event.turnIndex: number — 0-based index of this turn within the agent run
  // event.timestamp: number — when the turn started
});
```

### `context`

**Когда:** Перед каждым вызовом LLM, после начала хода. Это последний шанс изменить то, что видит LLM.

**Пожары:** На каждом ходу. Если LLM вызывает 3 инструмента и возвращается назад, `context` срабатывает 4 раза (один раз для первоначального вызова + один раз для каждого обратного цикла).

**Цепочка:** Последовательная. Каждый обработчик получает выходные данные предыдущего. Первый обработчик получает глубокую копию массива сообщений агента размером `structuredClone`.

```typescript
pi.on("context", async (event, ctx) => {
  // event.messages: AgentMessage[] — deep copy, safe to mutate
  
  // Filter out messages
  const filtered = event.messages.filter(m => !isIrrelevant(m));
  return { messages: filtered };
  
  // Or inject messages
  return { messages: [...event.messages, syntheticMessage] };
  
  // Or return nothing to pass through unchanged
});
```

**Что содержит `event.messages`:**
- Все роли: `user`, `assistant`, `toolResult`, `custom`, `bashExecution`, `compactionSummary`, `branchSummary`
- Сообщение пользователя из текущего приглашения
- Пользовательские сообщения, добавленные `before_agent_start`
- Результаты работы инструмента в результате предыдущих ходов этого запуска агента.
- Сообщения рулевого управления/последующие действия, которые стали сигналами поворота.
- Исторические сообщения сеанса (включая сводки уплотнения)

**Что содержит NOT:**
- Системное приглашение (для этого используйте `before_agent_start`)
- Определения инструментов (для этого используйте `pi.setActiveTools()`)

### `turn_end`

**Когда:** После того, как LLM ответит и все вызовы инструментов для этого поворота будут завершены.

```typescript
pi.on("turn_end", async (event, ctx) => {
  // event.turnIndex: number
  // event.message: AgentMessage — the assistant's response message
  // event.toolResults: ToolResultMessage[] — results from tools called this turn
});
```

### `message_start` / `message_update` / `message_end`

**Когда:** События жизненного цикла сообщения. `update` срабатывает только для сообщений помощника во время потоковой передачи (по токену).

```typescript
pi.on("message_start", async (event, ctx) => {
  // event.message: AgentMessage — user, assistant, toolResult, or custom
});

pi.on("message_update", async (event, ctx) => {
  // event.message: AgentMessage — partial assistant message (streaming)
  // event.assistantMessageEvent: AssistantMessageEvent — the specific token event
});

pi.on("message_end", async (event, ctx) => {
  // event.message: AgentMessage — final message
  // Messages are persisted to the session file at this point
});
```

---

## 4. Крючки для инструментов

### `tool_call`

**Когда:** После того, как LLM запрашивает вызов инструмента, перед его выполнением.

**Цепочка:** Последовательная. Если какой-либо обработчик возвращает `{ block: true }`, выполнение немедленно прекращается. Причиной блокировки становится ошибка, которая фиксируется и возвращается как результат работы инструмента с помощью `isError: true`.

```typescript
pi.on("tool_call", async (event, ctx) => {
  // event.toolCallId: string
  // event.toolName: string
  // event.input: typed based on tool (use isToolCallEventType for narrowing)
  
  // Block execution
  return { block: true, reason: "Not allowed in read-only mode" };
  
  // Allow execution (return nothing or undefined)
});
```

**Сужение типа:**
```typescript
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";

pi.on("tool_call", async (event, ctx) => {
  if (isToolCallEventType("bash", event)) {
    event.input.command; // string — typed!
  }
  if (isToolCallEventType("write", event)) {
    event.input.path;    // string
    event.input.content; // string
  }
  // Custom tools need explicit type params:
  if (isToolCallEventType<"my_tool", { action: string }>("my_tool", event)) {
    event.input.action;  // string
  }
});
```

### `tool_execution_start` / `tool_execution_update` / `tool_execution_end`

Информационные события во время работы инструмента. Нет возвращаемых значений.

```typescript
pi.on("tool_execution_start", async (event) => {
  // event.toolCallId, event.toolName, event.args
});

pi.on("tool_execution_update", async (event) => {
  // event.partialResult — streaming progress from onUpdate callback
});

pi.on("tool_execution_end", async (event) => {
  // event.result, event.isError
});
```

### `tool_result`

**Когда:** после завершения работы инструмента, прежде чем результат будет возвращен в цикл агента.

**Цепочка:** Последовательная. Каждый обработчик может изменить результат. Изменения накапливаются в обработчиках. Все обработчики видят развивающийся `currentEvent` с содержимым/подробными сведениями/isError, обновленными предыдущими обработчиками.

```typescript
pi.on("tool_result", async (event, ctx) => {
  // event.toolCallId: string
  // event.toolName: string
  // event.input: Record<string, unknown>
  // event.content: (TextContent | ImageContent)[]
  // event.details: unknown
  // event.isError: boolean
  
  // Modify the result
  return {
    content: [...event.content, { type: "text", text: "\n\nAudit: logged" }],
    isError: false, // can flip error state
  };
  
  // Return nothing to pass through unchanged
});
```

**Также срабатывает при ошибках:** Если выполнение инструмента дает сбой, `tool_result` по-прежнему срабатывает с `isError: true` и сообщением об ошибке в качестве содержимого. Расширения могут изменять даже результаты ошибок.

---

## 5. Перехватчики сеансов

### `session_start`

**Когда:** Начальная загрузка сеанса (запуск) и после переключения/разветвления сеанса. Также срабатывает после `/reload`.

**Используется для:** восстановления состояния из записей сеанса, начальной настройки.

```typescript
pi.on("session_start", async (_event, ctx) => {
  // Restore state from session
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type === "custom" && entry.customType === "my-state") {
      myState = entry.data;
    }
  }
});
```

### `session_before_switch` / `session_switch`

**Когда:** До/после `/new` или `/resume`.

```typescript
pi.on("session_before_switch", async (event) => {
  // event.reason: "new" | "resume"
  // event.targetSessionFile?: string (only for resume)
  return { cancel: true }; // prevent the switch
});
```

### `session_before_fork` / `session_fork`

**Когда:** До/после `/fork`.

```typescript
pi.on("session_before_fork", async (event) => {
  // event.entryId: string — the entry being forked from
  return { cancel: true };
  // or
  return { skipConversationRestore: true }; // fork without restoring messages
});
```

### `session_before_compact` / `session_compact`

**Когда:** До/после уплотнения (ручного или автоматического).

```typescript
pi.on("session_before_compact", async (event) => {
  // event.preparation: CompactionPreparation
  // event.branchEntries: SessionEntry[]
  // event.customInstructions?: string
  // event.signal: AbortSignal
  
  return { cancel: true };
  // or provide custom compaction:
  return {
    compaction: {
      summary: "My custom summary",
      firstKeptEntryId: event.preparation.firstKeptEntryId,
      tokensBefore: event.preparation.tokensBefore,
    }
  };
});
```

### `session_before_tree` / `session_tree`

**Когда:** до/после навигации по `/tree`.

```typescript
pi.on("session_before_tree", async (event) => {
  // event.preparation: TreePreparation
  // event.signal: AbortSignal
  
  return { cancel: true };
  // or provide custom summary:
  return {
    summary: { summary: "Custom branch summary" },
    label: "my-label",
  };
});
```

### `session_shutdown`

**Когда:** Выход из процесса (Ctrl+C, Ctrl+D, SIGTERM, `ctx.shutdown()`).

```typescript
pi.on("session_shutdown", async (_event, ctx) => {
  // Last chance to persist state
  // Keep it fast — process is exiting
});
```

---

## 6. Крючки для моделей

### `model_select`

**Когда:** Модель меняется с помощью `/model`, циклического нажатия клавиш Ctrl+P или восстановления сеанса.

```typescript
pi.on("model_select", async (event, ctx) => {
  // event.model: Model — the new model
  // event.previousModel: Model | undefined
  // event.source: "set" | "cycle" | "restore"
});
```

---

## 7. Хуки ресурсов

### `resources_discover`

**Когда:** При запуске и после `/reload`. Позволяет расширениям предоставлять дополнительные навыки, шаблон подсказки и пути к темам.

**Не описано в документации по расширению-pi.** Именно так расширения доставляют свои собственные ресурсы.

```typescript
pi.on("resources_discover", async (event, ctx) => {
  // event.cwd: string
  // event.reason: "startup" | "reload"
  
  return {
    skillPaths: [join(__dirname, "skills", "SKILL.md")],
    promptPaths: [join(__dirname, "prompts", "my-template.md")],
    themePaths: [join(__dirname, "themes", "dark.json")],
  };
});
```

**Поведение:** Возвращенные пути загружаются загрузчиком ресурсов и интегрируются в системную подсказку (навыки) и доступные команды (подсказки/темы). Системное приглашение перестраивается после расширения ресурсов.

---

## 8. Пользовательские хуки Bash

### `user_bash`

**Когда:** Пользователь выполняет команду с префиксом `!` или `!!` в редакторе.

```typescript
pi.on("user_bash", async (event, ctx) => {
  // event.command: string
  // event.excludeFromContext: boolean (true if !! prefix)
  // event.cwd: string
  
  // Provide custom execution (e.g., SSH)
  return {
    operations: { execute: (cmd) => sshExec(remote, cmd) },
  };
  
  // Or provide a full replacement result
  return {
    result: { output: "custom output", exitCode: 0, cancelled: false, truncated: false },
  };
});
```

---

## Порядок выполнения в расширениях

Все перехватчики перебирают расширения в **порядке загрузки** (сначала локально проекта, затем глобально, затем явно настраивается с помощью `-e`). Внутри каждого расширения обработчики одного и того же события выполняются в порядке регистрации.

Для крючков, образующих цепочку (например, `context`, `before_agent_start.systemPrompt`, `input`, `tool_result`):
- Сначала запускается обработчик расширения A, расширение B видит выходные данные A.
- Порядок загрузки определяет приоритет

Для перехватчиков, вызывающих короткое замыкание (например, `tool_call` с `block`, `input` с `handled`, сеанс `cancel`):
- Выигрывает первое расширение, возвращающее значение короткого замыкания.
- Остальные обработчики пропускаются.
