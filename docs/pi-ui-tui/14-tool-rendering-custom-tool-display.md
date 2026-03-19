# Визуализация инструмента — отображение пользовательского инструмента

Инструменты могут контролировать отображение вызовов и результатов в области сообщений.

### renderCall — Как выглядит вызов инструмента

```typescript
import { Text } from "@mariozechner/pi-tui";

pi.registerTool({
  name: "my_tool",
  // ...

  renderCall(args, theme) {
    // args = the tool call arguments
    let text = theme.fg("toolTitle", theme.bold("my_tool "));
    text += theme.fg("muted", args.action);
    if (args.text) text += " " + theme.fg("dim", `"${args.text}"`);
    return new Text(text, 0, 0);  // 0,0 padding — the wrapping Box handles padding
  },
});
```

### renderResult — Как выглядит результат работы инструмента

```typescript
import { Text } from "@mariozechner/pi-tui";
import { keyHint } from "@mariozechner/pi-coding-agent";

pi.registerTool({
  name: "my_tool",
  // ...

  renderResult(result, { expanded, isPartial }, theme) {
    // result.content — the content array sent to the LLM
    // result.details — your custom details object
    // expanded — whether user toggled expand (Ctrl+O)
    // isPartial — streaming in progress (onUpdate was called)

    // Handle streaming state
    if (isPartial) {
      return new Text(theme.fg("warning", "Processing..."), 0, 0);
    }

    // Handle errors
    if (result.details?.error) {
      return new Text(theme.fg("error", `Error: ${result.details.error}`), 0, 0);
    }

    // Default view (collapsed)
    let text = theme.fg("success", "✓ Done");
    if (!expanded) {
      text += ` (${keyHint("expandTools", "to expand")})`;
    }

    // Expanded view — show details
    if (expanded && result.details?.items) {
      for (const item of result.details.items) {
        text += "\n  " + theme.fg("dim", item);
      }
    }

    return new Text(text, 0, 0);
  },
});
```

### Подсказки для сочетаний клавиш

```typescript
import { keyHint, appKeyHint, editorKey, rawKeyHint } from "@mariozechner/pi-coding-agent";

// Editor action hint (respects user's keybinding config)
keyHint("expandTools", "to expand")    // e.g., "Ctrl+O to expand"
keyHint("selectConfirm", "to select")  // e.g., "Enter to select"

// Raw key hint
rawKeyHint("Ctrl+O", "to expand")      // Always shows "Ctrl+O to expand"
```

### Резервное поведение

Если `renderCall` или `renderResult` не определены или выбрасывают:
- `renderCall` → показывает название инструмента.
- `renderResult` → показывает необработанный текст из `content`.

### Лучшие практики

- Возврат `Text` с дополнением `(0, 0)` — обертка `Box` обрабатывает дополнение.
- Поддержка `expanded` для получения подробной информации по запросу.
- Ручка `isPartial` для потоковой передачи прогресса.
- Сохраняйте вид по умолчанию (свернутый) компактным.
- Используйте `\n` для многострочного содержимого в одном `Text`.

---
