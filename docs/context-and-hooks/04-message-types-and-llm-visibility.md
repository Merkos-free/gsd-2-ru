# Типы сообщений и видимость LLM

Каждое сообщение в pi имеет тип `AgentMessage`. Эти сообщения проходят через `convertToLlm` прежде, чем их увидит LLM. В этом документе точно указано, что LLM получает для каждого типа сообщений, а что он никогда не видит.

---

## Иерархия типов AgentMessage

Pi использует `AgentMessage` в качестве внутреннего типа сообщения, который представляет собой объединение стандартных сообщений LLM и пользовательских сообщений приложений:

```typescript
// Standard LLM messages
type Message = UserMessage | AssistantMessage | ToolResultMessage;

// Custom messages added by pi's coding agent
interface CustomAgentMessages {
  bashExecution: BashExecutionMessage;
  custom: CustomMessage;
  branchSummary: BranchSummaryMessage;
  compactionSummary: CompactionSummaryMessage;
}

// The union
type AgentMessage = Message | CustomAgentMessages[keyof CustomAgentMessages];
```

---

## Тип сообщения → LLM Таблица преобразования

| Тип сообщения агента | `role` просмотрено LLM | Преобразование контента | При исключении |
|---|---|---|---|
| `user` | `user` | Пройти без изменений | Никогда |
| `assistant` | `assistant` | Пройти без изменений | Никогда |
| `toolResult` | `toolResult` | Пройти без изменений | Никогда |
| `custom` | `user` | `content` сохранена как есть (строка → `[{type:"text",text}]`) | Никогда — специальные сообщения ALL достигают LLM |
| `bashExecution` | `user` | Отформатировано: `` Ran `cmd`\n```\noutput\n``` `` | When `excludeFromContext: префикс true` (`!!`) |
| `compactionSummary` | `user` | В упаковке: `The conversation history before this point was compacted into the following summary:\n<summary>\n...\n</summary>` | Никогда |
| `branchSummary` | `user` | В упаковке: `The following is a summary of a branch that this conversation came back from:\n<summary>\n...\n</summary>` | Никогда |

---

## Подробно о пользовательских сообщениях

Пользовательские сообщения создаются:
1. `pi.sendMessage()` — сообщения, внедренные расширением
2. `before_agent_start` возвращает `message` — внедрение контекста для каждого приглашения

### Заблуждение о поле `display`

```typescript
pi.sendMessage({
  customType: "my-context",
  content: "This text goes to the LLM",
  display: false,  // ← ONLY controls UI rendering
});
```

**Что контролирует `display`:**
- `true`: сообщение появляется в журнале чата TUI (отображается через `registerMessageRenderer`, если таковой существует, или рендеринг по умолчанию).
- `false`: сообщение скрыто из журнала чата TUI.

**Чем `display` управляет NOT:**
- Видимость LLM — LLM ALWAYS получает контент как сообщение роли `user`.
- Сохранение сеанса — сообщение ALWAYS сохраняется в файле сеанса.

### Как персонализированные сообщения становятся сообщениями пользователей

В `convertToLlm` (messages.ts):

```typescript
case "custom": {
  const content = typeof m.content === "string" 
    ? [{ type: "text", text: m.content }] 
    : m.content;
  return {
    role: "user",
    content,
    timestamp: m.timestamp,
  };
}
```

Все поля `customType`, `display` и `details` удалены. LLM видит простое пользовательское сообщение с содержимым.

---

## Сообщения о выполнении Bash

Создается, когда пользователь запускает команды с префиксом `!` или `!!`.

### `!` (включено в контекст)

```typescript
// User types: !ls -la
// LLM sees:
{
  role: "user",
  content: [{ type: "text", text: "Ran `ls -la`\n```\n<output>\n```" }]
}
```

При необходимости добавляется код выхода, информация об отмене и усечении:
- Ненулевой выход: `\n\nCommand exited with code N`
- Отменено: `\n\n(command cancelled)`
- Усечено: `\n\n[Output truncated. Full output: /path/to/file]`

### `!!` (исключено из контекста)

```typescript
// User types: !!echo secret
// LLM sees: NOTHING — filtered out by convertToLlm
```

Флаг `excludeFromContext` на `BashExecutionMessage` заставляет `convertToLlm` возвращать `undefined` для этого сообщения, фактически удаляя его.

---

## Сообщения о сжатии и сводке ветвей

Это синтетические сообщения, созданные управлением сеансами pi.

### Сводка по сжатию

При сжатии контекста старые сообщения заменяются кратким описанием:

```typescript
// LLM sees:
{
  role: "user",
  content: [{
    type: "text",
    text: "The conversation history before this point was compacted into the following summary:\n\n<summary>\n[LLM-generated summary of the compacted conversation]\n</summary>"
  }]
}
```

### Сводка ветвей

При переходе от ветки и обратно заброшенная ветка суммируется:

```typescript
// LLM sees:
{
  role: "user",
  content: [{
    type: "text",
    text: "The following is a summary of a branch that this conversation came back from:\n\n<summary>\n[summary of the branch]\n</summary>"
  }]
}
```

---

## Чего LLM никогда не видит

1. **`appendEntry` данные** — записи, относящиеся к внутреннему номеру (`pi.appendEntry("my-state", data)`), хранятся в файле сеанса, но NEVER включаются в массив сообщений. Это вовсе не типы `AgentMessage` — это записи сеанса `CustomEntry`.

2. **`details` в пользовательских сообщениях** — поле `details` предназначено для рендеринга и реконструкции состояния. `convertToLlm` снимает его.

3. **`details` в результатах инструмента** — результат инструмента `details` удаляется при преобразовании сообщения LLM. Только `content` достигает LLM.

4. **`!!` вывод выполнения bash** — Явно исключен из контекста.

5. **Определения инструментов отсутствуют в активном наборе** — Если инструмент зарегистрирован, но не в `getActiveTools()`, LLM не знает о его существовании.

6. **`promptSnippet` и `promptGuidelines` из неактивных инструментов** — в системную подсказку добавляются только активные инструменты.

---

## Порядок массива сообщений

Для типичного разговора массив сообщений, который видит LLM (после события `context` и `convertToLlm`), выглядит следующим образом:

```
1. [compactionSummary → user]  (if compaction happened)
2. [branchSummary → user]      (if navigated back from a branch)
3. [user]                       (first user message after compaction)
4. [assistant]                  (LLM response)
5. [toolResult]                 (tool results)
6. [user]                       (next user message)
7. [custom → user]              (extension-injected message)
8. ...continues...
9. [user]                       (current prompt)
10. [custom → user]             (before_agent_start injected messages)
11. [custom → user]             (nextTurn queued messages)
```

---

## Значение для авторов расширений

### Если вы хотите, чтобы LLM что-то увидел:
- Используйте `before_agent_start` → `message` для контекста каждой подсказки.
- Используйте событие `context` для вставки в массив сообщений за ход.
– Используйте `pi.sendMessage` для отдельных сообщений.
- Используйте `before_agent_start` → `systemPrompt` для получения инструкций на уровне системы.

### Если вы хотите что-то скрыть от LLM:
- Используйте `pi.appendEntry` — никогда не достигает массива сообщений.
- Использовать результат инструмента `details` — сохраняется в сеансе, но удаляется до LLM.
- Используйте событие `context` для фильтрации сообщений OUT массива.
- Существует NO способ вставки сообщений, содержащих только UI, которые участвуют в потоке разговора - `display: false` скрывается только от TUI, а не от LLM.

### Если вы хотите, чтобы что-то выдержало сжатие:
- Сохраните его в результате инструмента `details` (сохранится в сохраненных записях)
- Сохраните его в `appendEntry` (сохраняется как данные сеанса, а не сообщения)
- Каждый раз повторно вводите его через `before_agent_start` (выживает, потому что вы его регенерируете)
- Сообщения в сжатом диапазоне заменяются сводкой уплотнения — они исчезли с точки зрения LLM.
