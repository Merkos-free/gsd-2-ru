# Шаблоны внедрения контекста

Практические рецепты внедрения, фильтрации, преобразования и управления контекстом с помощью системы перехватчиков pi. В каждом шаблоне указано, когда его использовать, какой крючок использовать и точную реализацию.

---

## Шаблон 1: Изменение системных подсказок для каждой подсказки

**Используйте, когда:** Вы хотите изменить поведение LLM для всего запуска агента на основе какого-либо условия.

**Крюк:** `before_agent_start`

```typescript
let debugMode = false;

pi.registerCommand("debug", {
  handler: async (_args, ctx) => {
    debugMode = !debugMode;
    ctx.ui.notify(debugMode ? "Debug mode ON" : "Debug mode OFF");
  },
});

pi.on("before_agent_start", async (event) => {
  if (debugMode) {
    return {
      systemPrompt: event.systemPrompt + `

## Debug Mode
- Show your reasoning for each decision
- Before executing any tool, explain what you expect to happen
- After each tool result, explain what you learned
- If something unexpected happens, stop and explain before continuing`,
    };
  }
});
```

**Почему `before_agent_start`, а не `context`:** Системное приглашение отделено от массива сообщений. `context` может изменять только сообщения, но не системные подсказки.

---

## Шаблон 2: невидимое внедрение контекста

**Используйте, когда:** вам нужно нажать LLM, чтобы узнать что-то так, чтобы пользователь не увидел это в чате.

**Крючок:** `before_agent_start` с `display: false`

```typescript
pi.on("before_agent_start", async (event, ctx) => {
  const gitBranch = await getBranch();
  const recentCommits = await getRecentCommits(5);
  
  return {
    message: {
      customType: "git-context",
      content: `[Git Context] Branch: ${gitBranch}\nRecent commits:\n${recentCommits}`,
      display: false,  // User doesn't see this in chat
      // But the LLM DOES see it — display only controls UI rendering
    },
  };
});
```

**Важно!** `display: false` скрывается только от UI. LLM всегда получает специальные сообщения в качестве содержимого роли `user`. Невозможно внедрить невидимые для LLM метаданные через `sendMessage` или `before_agent_start`.

---

## Шаблон 3: Условная контекстная фильтрация

**Используйте, когда:** Некоторые сообщения в истории больше не актуальны и тратят токены контекста.

**Крюк:** `context`

```typescript
pi.on("context", async (event) => {
  return {
    messages: event.messages.filter(m => {
      // Remove custom messages from a previous mode
      if (m.role === "custom" && m.customType === "plan-mode-context") {
        return currentMode === "plan"; // only keep if still in plan mode
      }
      
      // Remove old bash executions beyond the last 10
      if (m.role === "bashExecution") {
        return bashCount++ >= totalBash - 10;
      }
      
      return true;
    }),
  };
});
```

**Почему `context`, а не `before_agent_start`:** `context` срабатывает каждый ход и может видеть полный массив сообщений, включая результаты работы инструмента на предыдущих ходах. `before_agent_start` срабатывает один раз и может только внедрить — он не может фильтровать существующие сообщения.

---

## Шаблон 4: Динамическое внедрение контекста за ход

**Используйте, когда:** вы хотите добавить контекст, который меняется между ходами (например, текущее состояние файла, выходные данные запущенного процесса).

**Крюк:** `context`

```typescript
pi.on("context", async (event, ctx) => {
  // Inject a synthetic message at the end of the conversation
  const liveStatus = await getProcessStatus();
  
  const contextMessage = {
    role: "user" as const,
    content: [{ type: "text" as const, text: `[Live Status] ${liveStatus}` }],
    timestamp: Date.now(),
  };
  
  return {
    messages: [...event.messages, contextMessage],
  };
});
```

**Внимание!** Сообщения, добавленные в `context`, сохраняются в сеансе NOT. Они существуют только для вызова LLM. На следующем ходу вам нужно будет сделать инъекцию снова. Это на самом деле полезно — значит, контекст всегда свежий.

---

## Шаблон 5: Отложенный контекст (следующий ход)

**Используйте, когда:** вы хотите прикрепить контекст к следующему запросу пользователя, не прерывая текущий разговор.

**Механизм:** `pi.sendMessage` с `deliverAs: "nextTurn"`

```typescript
// Queue context for the next user prompt
pi.sendMessage(
  {
    customType: "deferred-context",
    content: "The test suite passed with 47/47 tests",
    display: false,
  },
  { deliverAs: "nextTurn" }
);
```

**Как это работает внутри:** Сообщение сохраняется в `_pendingNextTurnMessages` и вводится в массив `messages` при вызове следующего `agent.prompt()` после сообщения пользователя. В отличие от внедрения перехватчика `context`, эти сообщения ARE сохраняются в сеансе.

---

## Шаблон 6: Управление контекстными окнами

**Используйте, когда:** Вы приближаетесь к пределу контекста и вам необходимо разумно сократить его.

**Крюк:** `context`

```typescript
pi.on("context", async (event, ctx) => {
  const usage = ctx.getContextUsage();
  if (!usage || usage.percent === null || usage.percent < 70) {
    return; // plenty of room
  }
  
  // Aggressive pruning: remove tool results beyond the last 20
  let toolResultCount = 0;
  const total = event.messages.filter(m => m.role === "toolResult").length;
  
  return {
    messages: event.messages.filter(m => {
      if (m.role === "toolResult") {
        toolResultCount++;
        // Keep last 20 tool results
        return toolResultCount > total - 20;
      }
      return true;
    }),
  };
});
```

---

## Шаблон 7: Управление контекстом

**Используйте, когда:** вы хотите перенаправить агента в процессе работы с дополнительным контекстом.

**Механизм:** `pi.sendMessage` с `deliverAs: "steer"`

```typescript
// During an agent run, inject a steering message
pi.sendMessage(
  {
    customType: "user-feedback",
    content: "IMPORTANT: The user just updated the config file. Re-read config.json before continuing.",
    display: true,
  },
  { deliverAs: "steer" }
);
```

**Что происходит:** Текущий вызов инструмента завершается, оставшиеся вызовы инструмента в очереди пропускаются (они получают результаты об ошибке «Пропущено из-за сообщения пользователя в очереди»), а сообщение управления становится входным для следующего поворота.

---

## Шаблон 8: Последующий контекст после завершения

**Используйте, когда:** вы хотите запустить еще один ход LLM после завершения работы агента с дополнительным контекстом.

**Механизм:** `pi.sendMessage` с `deliverAs: "followUp"`

```typescript
pi.on("agent_end", async (event, ctx) => {
  // Check if the agent made changes that need verification
  const hasEdits = event.messages.some(m => 
    m.role === "toolResult" && m.toolName === "edit"
  );
  
  if (hasEdits) {
    pi.sendMessage(
      {
        customType: "auto-verify",
        content: "You just made edits. Please verify them by running the test suite.",
        display: true,
      },
      { deliverAs: "followUp", triggerTurn: true }
    );
  }
});
```

---

## Шаблон 9: Контекст на уровне инструмента через promptGuidelines

**Используйте, когда:** вам нужен контекст, который появляется только тогда, когда активны определенные инструменты.

**Механизм:** `promptGuidelines` при регистрации инструмента.

```typescript
pi.registerTool({
  name: "deploy",
  label: "Deploy",
  description: "Deploy the application",
  promptSnippet: "Deploy the application to staging or production",
  promptGuidelines: [
    "Always run tests before deploying",
    "Never deploy to production without explicit user confirmation",
    "After deploying, verify the health check endpoint",
  ],
  parameters: Type.Object({ /* ... */ }),
  async execute(toolCallId, params, signal, onUpdate, ctx) { /* ... */ },
});
```

**Поведение:** `promptGuidelines` добавляются в раздел «Направляющие» системной подсказки ONLY, когда инструмент `deploy` находится в активном наборе инструментов. Если инструмент отключен с помощью `pi.setActiveTools(...)`, направляющие исчезнут.

---

## Шаблон 10: Постоянное состояние как контекст

**Используйте, когда:** Вам нужно состояние, при котором после возобновления сеанса AND будет видно LLM.

**Механизм:** Результат инструмента `details` + `session_start` реконструкция + `before_agent_start` инъекция

```typescript
let projectFacts: string[] = [];

pi.on("session_start", async (_event, ctx) => {
  // Reconstruct from session
  projectFacts = [];
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type === "message" && entry.message.role === "toolResult") {
      if (entry.message.toolName === "learn_fact") {
        projectFacts = entry.message.details?.facts ?? [];
      }
    }
  }
});

pi.registerTool({
  name: "learn_fact",
  label: "Learn Fact",
  description: "Record a fact about the project",
  parameters: Type.Object({ fact: Type.String() }),
  async execute(toolCallId, params) {
    projectFacts.push(params.fact);
    return {
      content: [{ type: "text", text: `Learned: ${params.fact}` }],
      details: { facts: [...projectFacts] }, // snapshot in details for branching
    };
  },
});

pi.on("before_agent_start", async (event) => {
  if (projectFacts.length > 0) {
    return {
      message: {
        customType: "project-facts",
        content: `Known project facts:\n${projectFacts.map(f => `- ${f}`).join("\n")}`,
        display: false,
      },
    };
  }
});
```

**Почему это работает для ветвления:** Состояние находится в результате инструмента `details`, поэтому, когда пользователь разветвляется от более ранней точки, `session_start` восстанавливается из `getBranch()` (текущий путь), а не из всей истории. Факты из старых веток не просачиваются в новые ветки.

---

## Шаблон 11: Предварительная обработка ввода/макросы

**Используйте, когда:** вам нужен собственный синтаксис, который раскрывается до того, как его увидит LLM.

**Крюк:** `input`

```typescript
pi.on("input", async (event) => {
  // Expand @file references to file contents
  const expanded = event.text.replace(/@(\S+)/g, (match, filePath) => {
    try {
      const content = readFileSync(filePath, "utf-8");
      return `\`\`\`${filePath}\n${content}\n\`\`\``;
    } catch {
      return match; // leave unchanged if can't read
    }
  });
  
  if (expanded !== event.text) {
    return { action: "transform", text: expanded };
  }
  return { action: "continue" };
});
```

---

## Шаблон 12: Блокировка контекстно-зависимых инструментов

**Используйте, когда:** вы хотите запретить использование определенных инструментов в зависимости от контекста разговора.

**Хук:** `tool_call` с учетом `context`

```typescript
let inPlanMode = false;

pi.on("tool_call", async (event, ctx) => {
  if (!inPlanMode) return;
  
  const destructiveTools = ["edit", "write", "bash"];
  
  if (event.toolName === "bash" && isToolCallEventType("bash", event)) {
    // Allow read-only bash commands
    if (isSafeCommand(event.input.command)) return;
  }
  
  if (destructiveTools.includes(event.toolName)) {
    return {
      block: true,
      reason: `Plan mode active: ${event.toolName} is not allowed. Use /plan to exit plan mode.`,
    };
  }
});
```

---

## Антипаттерны

### ❌ Не следует: изменять системную подсказку в `context`.

```typescript
// WRONG — context event can only modify messages, not the system prompt
pi.on("context", async (event, ctx) => {
  // This does nothing to the system prompt
  return { systemPrompt: "new prompt" }; // ← not a valid return field
});
```

### ❌ Не следует: полагайтесь на `display: false` для обеспечения безопасности.

```typescript
// WRONG — display: false only hides from UI, LLM still sees it
pi.on("before_agent_start", async () => ({
  message: {
    customType: "secret",
    content: "API_KEY=sk-1234", // LLM receives this as a user message!
    display: false,
  },
}));
```

### ❌ Не следует: используйте `context` для однократной инъекции.

```typescript
// WRONG — context fires every turn, so this injects repeatedly
let injected = false;
pi.on("context", async (event) => {
  if (!injected) {
    injected = true;
    return { messages: [...event.messages, myMessage] };
  }
});
// Problem: after compaction or session restore, injected resets to false
```

Вместо этого используйте `before_agent_start` с `message` для однократной инъекции для каждого запроса.

### ❌ Не следует: используйте `getEntries()` для состояния ветвления.

```typescript
// WRONG — getEntries() returns ALL entries including dead branches
for (const entry of ctx.sessionManager.getEntries()) { /* ... */ }

// CORRECT — getBranch() returns only entries on the current branch path
for (const entry of ctx.sessionManager.getBranch()) { /* ... */ }
```
