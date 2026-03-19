# Управление состоянием и сохранение


### Шаблон: состояние в сведениях о результатах инструмента

Рекомендуемый подход для инструментов с отслеживанием состояния. Состояние находится в `details`, поэтому оно корректно работает с ветвлением/разветвлением.

```typescript
export default function (pi: ExtensionAPI) {
  let items: string[] = [];

  // Reconstruct from session on load
  pi.on("session_start", async (_event, ctx) => {
    items = [];
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type === "message" && entry.message.role === "toolResult") {
        if (entry.message.toolName === "my_tool") {
          items = entry.message.details?.items ?? [];
        }
      }
    }
  });

  pi.registerTool({
    name: "my_tool",
    // ...
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      items.push(params.text);
      return {
        content: [{ type: "text", text: "Added" }],
        details: { items: [...items] },  // ← Snapshot state here
      };
    },
  });
}
```

### Шаблон: Расширение-частное состояние (appendEntry)

Для состояния, которое не участвует в контексте LLM, но должно пережить перезапуск:

```typescript
pi.appendEntry("my-state", { count: 42, lastRun: Date.now() });

// Restore on reload
pi.on("session_start", async (_event, ctx) => {
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type === "custom" && entry.customType === "my-state") {
      const data = entry.data;  // { count: 42, lastRun: ... }
    }
  }
});
```

---
