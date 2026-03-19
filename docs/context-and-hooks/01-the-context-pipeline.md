# Контекстный конвейер

Полный путь пользовательской подсказки от нажатия клавиши до ввода LLM на каждом этапе преобразования. Понимание этого конвейера является основой всей контекстной инженерии в pi.

---

## Коротко о трубопроводе

```
User types prompt and hits Enter
│
├─► Extension command check (/command)
│   If match → run handler, skip everything below
│
├─► input event
│   Extensions can: transform text/images, intercept entirely, or pass through
│
├─► Skill expansion (/skill:name)
│   Skill file content injected into prompt text
│
├─► Prompt template expansion (/template)
│   Template file content merged into prompt text
│
├─► before_agent_start event [ONCE per user prompt]
│   Extensions can:
│     • Inject custom messages (appended after user message)
│     • Modify the system prompt (chained across extensions)
│
├─► Agent.prompt(messages)
│   Messages array: [user message, ...nextTurn messages, ...extension messages]
│
│   ┌── Turn loop (repeats while LLM calls tools) ──────────────┐
│   │                                                            │
│   │  transformContext (= context event) [EVERY turn]           │
│   │    Extensions receive AgentMessage[] deep copy             │
│   │    Can filter, reorder, inject, or replace messages        │
│   │    Multiple handlers chain: each sees previous output      │
│   │                                                            │
│   │  convertToLlm [EVERY turn, AFTER context event]           │
│   │    AgentMessage[] → Message[]                              │
│   │    Custom types mapped to user role                        │
│   │    bashExecution (!! prefix) filtered out                  │
│   │    Not extensible — hardcoded in messages.ts               │
│   │                                                            │
│   │  LLM call                                                  │
│   │    System prompt + converted messages + tool definitions   │
│   │                                                            │
│   │  Tool execution (if LLM calls tools)                       │
│   │    tool_call event → can block                             │
│   │    execute runs                                            │
│   │    tool_result event → can modify result                   │
│   │    Steering check → may skip remaining tools               │
│   │                                                            │
│   │  Follow-up check (if no more tool calls)                   │
│   │    Queued follow-up messages become next turn input         │
│   │                                                            │
│   └────────────────────────────────────────────────────────────┘
│
└─► agent_end event
```

---

## Подробности поэтапно

### Этап 1. Проверка команд расширения

Первое, что происходит. Если текст начинается с `/` и соответствует зарегистрированной команде расширения, запускается обработчик команды, и **приглашение никогда не доходит до агента**. Никакие события не срабатывают. Никакого вызова LLM не происходит.

Это означает, что команды расширения представляют собой полностью синхронные аварийные выходы — они выполняются даже во время потоковой передачи (они проверяются перед любой логикой организации очереди).

### Этап 2: Входное событие

```typescript
pi.on("input", async (event, ctx) => {
  // event.text — the raw user input
  // event.images — attached images, if any
  // event.source — "interactive" | "rpc" | "extension"
  
  // Three possible return values:
  return { action: "continue" };                    // pass through unchanged
  return { action: "transform", text: "new text" }; // rewrite the input
  return { action: "handled" };                      // swallow entirely
});
```

**Объединение**: цепочка из нескольких обработчиков `input`. Если обработчик A возвращает `transform`, обработчик B видит преобразованный текст. Если какой-либо обработчик возвращает `handled`, конвейер останавливается — вызов LLM отсутствует.

**Время:** срабатывает перед расширением навыка/шаблона. Ваш обработчик видит необработанный текст `/skill:name args`, а не расширенное содержимое.

### Этап 3: Расширение навыков и шаблонов

Детерминированная замена текста. `/skill:name args` становится содержимым файла навыков, заключенным в теги `<skill>`. `/template args` становится содержимым файла шаблона. Это замены строк — никаких событий не происходит.

### Этап 4: before_agent_start

```typescript
pi.on("before_agent_start", async (event, ctx) => {
  // event.prompt — the expanded user prompt text
  // event.images — attached images
  // event.systemPrompt — current system prompt (may be modified by earlier extensions)
  
  return {
    message: {
      customType: "my-context",
      content: "Context the LLM should see",
      display: false,  // UI rendering only — LLM ALWAYS sees it
    },
    systemPrompt: event.systemPrompt + "\nExtra instructions",
  };
});
```

**Важные факты:**
- Срабатывает **один раз** для каждого запроса пользователя, а не за ход.
- Системные подсказки **цепочка**: расширение A изменяет его, расширение B видит измененную версию в `event.systemPrompt`.
- Сообщения **накапливаются**: сообщения всех расширений собираются и вводятся как отдельные записи.
- Если ни одно расширение не возвращает `systemPrompt`, базовая системная подсказка восстанавливается (изменения предыдущего хода не сохраняются).

**Порядок внедрения сообщений в конечный массив:**
```
[user message] → [nextTurn messages] → [extension messages from before_agent_start]
```

### Этап 5: Петля поворота

Именно здесь на самом деле называется LLM. Цикл поворота повторяется для каждого ответа LLM, включающего вызовы инструментов.

#### 5a: transformContext / контекстное событие

Событие `context` подключается как обратный вызов `transformContext` на агенте. Он срабатывает **каждый ход** в цикле агента.

```typescript
// Inside the agent loop (agent-loop.ts):
let messages = context.messages;
if (config.transformContext) {
  messages = await config.transformContext(messages, signal);
}
const llmMessages = await config.convertToLlm(messages);
```

Обработчик событий `context` в бегуне создает глубокую копию `structuredClone`:

```typescript
// runner.ts emitContext():
let currentMessages = structuredClone(messages);
// ...each handler receives and can modify currentMessages
```

**Это означает:**
- Вы получаете глубокую копию, которую можно безопасно изменять, объединять, фильтровать или заменять.
- Вы работаете на уровне `AgentMessage[]` (включая нестандартные типы)
- Несколько цепочек обработчиков: каждый видит вывод предыдущего
- **Здесь нельзя изменить системное приглашение** — это может сделать только `before_agent_start`.
- Сообщения включают в себя все: сообщения пользователя, ответы помощника, результаты инструментов, пользовательские сообщения, выполнения bash, сводки уплотнения, сводки ветвей.

#### 5б: convertToLlm

После обработки события `context` `convertToLlm` сопоставляет `AgentMessage[]` с `Message[]`:

| Роль AgentMessage | Преобразовано в | Заметки |
|---|---|---|
| `user` | `user` | Пройти |
| `assistant` | `assistant` | Пройти |
| `toolResult` | `toolResult` | Пройти |
| `custom` | `user` | Содержимое сохранено, поле `display` игнорируется |
| `bashExecution` | `user` | Если только `excludeFromContext` (префикс `!!`) → отфильтровано |
| `compactionSummary` | `user` | Завернуты в теги `<summary>` |
| `branchSummary` | `user` | Обернутый тегами `<summary>` |

**`convertToLlm` не подлежит расширению.** Это жестко запрограммированная функция в `messages.ts`. Если вам нужно изменить способ отображения сообщений для LLM, сделайте это в обработчике событий `context` перед этим этапом.

#### 5c: LLM Звонок

Преобразованные сообщения, системные приглашения и определения инструментов передаются поставщику LLM. Используемое системное приглашение — это то, что было установлено с помощью `before_agent_start` (или базовое приглашение, если никакое расширение не изменило его).

#### 5d: Выполнение и перехват инструмента

Когда LLM отвечает вызовами инструментов, они выполняются последовательно:

```
For each tool call:
  tool_call event → can { block: true, reason: "..." }
    If blocked → Error("reason") becomes the tool result
  tool_execution_start event (informational)
  tool.execute() runs
  tool_execution_end event (informational)
  tool_result event → can modify { content, details, isError }
  
  Steering check → if steering messages queued:
    Remaining tools get "Skipped due to queued user message"
    Steering messages become input for next turn
```

### Этап 6: Последующие действия и продолжение

Когда LLM завершается и больше нет вызовов инструмента:
1. Проверьте сообщения рулевого управления → если они есть, начните с них новый поворот.
2. Проверьте наличие последующих сообщений → если они есть, начните с них новый ход.
3. Если ни один из → `agent_end` не сработает, агент переходит в режим ожидания.

---

## Что на самом деле видит LLM

За любой ход LLM получает:

```
System prompt (base + before_agent_start modifications)
  +
Messages (after context event filtering, after convertToLlm mapping)
  +
Tool definitions (active tools with names, descriptions, parameter schemas)
```

Системная подсказка включает в себя:
- Базовая подсказка (описания инструментов, рекомендации, ссылки на документы Pi, дата/время, cwd)
- `promptSnippet` переопределяет активные инструменты (заменяет описание инструмента в «Доступные инструменты»)
- `promptGuidelines` из активных инструментов (добавлено в раздел «Рекомендации»)
- `appendSystemPrompt` из настроек/конфигурации
- Файлы контекста проекта (AGENTS.md, CLAUDE.md из предков cwd)
- Список навыков (имена + описания, агент использует `read` для их загрузки)
- Любые модификации `before_agent_start`

---

## Ключевые временные различия

| Крюк | Когда | Как часто | Можно изменить |
|------|------|-----------|-----------|
| `input` | До расширения | Один раз для каждого пользовательского ввода | Введите текст |
| `before_agent_start` | После расширения, перед циклом агента | Один раз для каждого пользователя | Системная подсказка + вставка сообщений |
| `context` | Перед каждым звонком LLM | Каждый ход в цикле агента | Массив сообщений |
| `tool_call` | Перед каждым выполнением инструмента | За вызов инструмента | Блок исполнения |
| `tool_result` | После каждого выполнения инструмента | За вызов инструмента | Содержание результата/детали |

---

## Вопрос о глубоком копировании

Когда вы получаете копию, безопасную для мутаций, а не ссылку?

| Крюк | Что вы получаете | Безопасно мутировать? |
|------|-----------------|-----------------|
| `context` | `structuredClone` глубокая копия | Да |
| `before_agent_start` | `event.systemPrompt` — строка (неизменяемая) | Вернуть новую строку |
| `tool_call` | `event.input` — это необработанный объект args | Не мутировать — вернуть `block` |
| `tool_result` | `{ ...event }` мелкое распространение | Возвращать новые значения, не мутировать |
| `input` | `event.text` — строка (неизменяемая) | Вернуть новый текст с помощью `transform` |
