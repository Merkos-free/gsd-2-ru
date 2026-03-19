# Рендеринг сообщений — отображение настраиваемых сообщений

Зарегистрируйте средство визуализации для сообщений с помощью `customType`:

```typescript
import { Text } from "@mariozechner/pi-tui";

pi.registerMessageRenderer("my-extension", (message, options, theme) => {
  const { expanded } = options;

  let text = theme.fg("accent", `[${message.customType}] `);
  text += message.content;

  if (expanded && message.details) {
    text += "\n" + theme.fg("dim", JSON.stringify(message.details, null, 2));
  }

  return new Text(text, 0, 0);
});
```

Отправляйте сообщения, использующие этот рендерер:

```typescript
pi.sendMessage({
  customType: "my-extension",  // Must match registerMessageRenderer
  content: "Status update",
  display: true,               // Show in TUI
  details: { progress: 50 },   // Available in renderer, NOT sent to LLM
});
```

---
