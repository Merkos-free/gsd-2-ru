# События — Нервная система


События — это ядро системы расширений. Они делятся на пять категорий:

### 7.1 События сеанса

| Событие | Когда | Можно вернуться |
|-------|------|------------|
| `session_start` | Сеансовые нагрузки | — |
| `session_before_switch` | До `/new` или `/resume` | `{ cancel: true }` |
| `session_switch` | После переключения сеанса | — |
| `session_before_fork` | До `/fork` | `{ cancel: true }` или `{ skipConversationRestore: true }` |
| `session_fork` | После вилки | — |
| `session_before_compact` | Перед уплотнением | `{ cancel: true }` или `{ compaction: {...} }` (собственное описание) |
| `session_compact` | После уплотнения | — |
| `session_before_tree` | До `/tree` навигации | `{ cancel: true }` или `{ summary: {...} }` |
| `session_tree` | После навигации по дереву | — |
| `session_shutdown` | При выходе (Ctrl+C, Ctrl+D, SIGTERM) | — |

### 7.2 События агента

| Событие | Когда | Можно вернуться |
|-------|------|------------|
| `before_agent_start` | После запроса пользователя, перед циклом агента | `{ message: {...}, systemPrompt: "..." }` |
| `agent_start` | Цикл агента начинается | — |
| `agent_end` | Цикл агента завершается | — |
| `turn_start` | Каждый ход LLM начинается | — |
| `turn_end` | Каждый ход LLM заканчивается | — |
| `context` | Перед каждым звонком LLM | `{ messages: [...] }` (измененная копия) |
| `message_start/update/end` | Жизненный цикл сообщения | — |

### 7.3 События инструмента

| Событие | Когда | Можно вернуться |
|-------|------|------------|
| `tool_call` | Перед выполнением инструмента | `{ block: true, reason: "..." }` |
| `tool_execution_start` | Инструмент начинает выполнение | — |
| `tool_execution_update` | Инструмент отправляет прогресс | — |
| `tool_execution_end` | Отделка инструментов | — |
| `tool_result` | После выполнения инструмента | `{ content: [...], details: {...}, isError: bool }` (изменить результат) |

### 7.4 Входные события

| Событие | Когда | Можно вернуться |
|-------|------|------------|
| `input` | Пользовательский ввод получен (до расширения навыка/шаблона) | `{ action: "transform", text: "..." }` или `{ action: "handled" }` или `{ action: "continue" }` |

### 7.5 События модели

| Событие | Когда | Можно вернуться |
|-------|------|------------|
| `model_select` | Изменения модели (`/model`, Ctrl+P, восстановить) | — |

### 7.6 Пользовательские события Bash

| Событие | Когда | Можно вернуться |
|-------|------|------------|
| `user_bash` | Пользователь запускает команды `!` или `!!` | `{ operations: ... }` или `{ result: {...} }` |

### Подпись обработчика событий

```typescript
pi.on("event_name", async (event, ctx: ExtensionContext) => {
  // event — typed payload for this event
  // ctx — access to UI, session, model, and control flow
  
  // Return undefined for no action, or a typed response object
});
```

### Сужение типа для событий инструмента

```typescript
import { isToolCallEventType, isBashToolResult } from "@mariozechner/pi-coding-agent";

pi.on("tool_call", async (event, ctx) => {
  if (isToolCallEventType("bash", event)) {
    // event.input is typed as { command: string; timeout?: number }
  }
  if (isToolCallEventType("write", event)) {
    // event.input is typed as { path: string; content: string }
  }
});

pi.on("tool_result", async (event, ctx) => {
  if (isBashToolResult(event)) {
    // event.details is typed as BashToolDetails
  }
});
```

---
