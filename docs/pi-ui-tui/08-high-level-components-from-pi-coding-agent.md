# Компоненты высокого уровня из pi-coding-agent

### Динамическая граница

Горизонтальная граница с тематическим цветом. Используйте для создания диалогов.

```typescript
import { DynamicBorder } from "@mariozechner/pi-coding-agent";

// ⚠️ MUST explicitly type the parameter as string
const border = new DynamicBorder((s: string) => theme.fg("accent", s));
```

### Бордередлоадер

Спиннер с поддержкой отмены. Показывает сообщение и анимированный счетчик во время асинхронной работы.

```typescript
import { BorderedLoader } from "@mariozechner/pi-coding-agent";

const result = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
  const loader = new BorderedLoader(tui, theme, "Fetching data...");
  loader.onAbort = () => done(null);  // Escape pressed

  // Do async work with the loader's AbortSignal
  fetchData(loader.signal)
    .then(data => done(data))
    .catch(() => done(null));

  return loader;
});
```

### Пользовательский редактор

Базовый класс для пользовательских редакторов, заменяющих ввод. Автоматически обеспечивает связывание клавиш приложения (Escape для прерывания, ctrl+d, переключение модели).

```typescript
import { CustomEditor } from "@mariozechner/pi-coding-agent";

class MyEditor extends CustomEditor {
  handleInput(data: string): void {
    // Handle your keys first
    if (data === "x") { /* custom behavior */ return; }
    // Fall through to CustomEditor for app keybindings + text editing
    super.handleInput(data);
  }
}
```

---
