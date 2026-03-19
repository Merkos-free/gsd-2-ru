# Цикл агента — как думает Пи

Цикл агента — это сердцебиение числа Пи. Вот что происходит между отправкой запроса и получением ответа:

```
User sends prompt
    │
    ▼
┌─ TURN START ──────────────────────────────────────┐
│                                                    │
│  1. Assemble context                               │
│     - System prompt (+ modifications from hooks)   │
│     - Previous messages (or compaction summary)     │
│     - The new user message                         │
│                                                    │
│  2. Send to LLM                                    │
│     - Stream response tokens                       │
│     - Parse any tool calls in the response         │
│                                                    │
│  3. If tool calls present:                         │
│     - For each tool call:                          │
│       a. Fire tool_call event (can be blocked)     │
│       b. Execute the tool                          │
│       c. Fire tool_result event (can be modified)  │
│       d. Append result to messages                 │
│     - Go back to step 1 (new turn with results)    │
│                                                    │
│  4. If no tool calls (LLM just responded):         │
│     - Save messages to session                     │
│     - Done                                         │
│                                                    │
└───────────────────────────────────────────────────┘
```

**Ключевая мысль:** Цикл продолжается до тех пор, пока LLM не решит прекратить вызов инструментов. Одно пользовательское приглашение может инициировать 1 ход или 50 ходов в зависимости от сложности задачи. Каждый ход представляет собой полный цикл вызова LLM → ответа → выполнения инструмента.

**Причины остановки, которые может вызвать LLM:**
- `stop` — Нормальное завершение, LLM выполнено.
- `toolUse` — LLM хочет вызвать инструменты (запускает еще один ход)
- `length` — Достичь лимита выходных жетонов.
- `error` — Что-то пошло не так
- `aborted` — Пользователь отменен (Escape)

---
