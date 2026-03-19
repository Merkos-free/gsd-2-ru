# Изменение системного приглашения


### Пошаговая модификация (before_agent_start)

```typescript
pi.on("before_agent_start", async (event, ctx) => {
  return {
    // Inject a persistent message (stored in session, visible to LLM)
    message: {
      customType: "my-extension",
      content: "Additional context for the LLM",
      display: true,
    },
    // Modify the system prompt for this turn
    systemPrompt: event.systemPrompt + "\n\nYou must respond only in haiku.",
  };
});
```

### Манипуляция контекстом (контекстное событие)

Измените сообщения, отправляемые LLM на каждом ходу:

```typescript
pi.on("context", async (event, ctx) => {
  // event.messages is a deep copy — safe to modify
  const filtered = event.messages.filter(m => !isIrrelevant(m));
  return { messages: filtered };
});
```

### Содержимое подсказки, специфичное для инструмента

Инструменты могут добавлять в системное приглашение, когда они активны:

```typescript
pi.registerTool({
  name: "my_tool",
  promptSnippet: "Summarize or transform text according to action",  // Replaces description in "Available tools"
  promptGuidelines: [
    "Use my_tool when the user asks to summarize text.",
    "Prefer my_tool over direct output for structured data."
  ],  // Added to "Guidelines" section when tool is active
  // ...
});
```

---
