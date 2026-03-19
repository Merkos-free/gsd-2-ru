# ctx.ui.custom() — Полные пользовательские компоненты

Это самый мощный механизм UI. Он **временно заменяет редактор** вашим компонентом. Возвращает значение при вызове `done()`.

### Базовый узор

```typescript
const result = await ctx.ui.custom<string | null>((tui, theme, keybindings, done) => {
  // tui        — TUI instance (requestRender, screen dimensions)
  // theme      — Current theme for styling
  // keybindings — App keybinding manager
  // done(value) — Call to close component and return value

  return {
    render(width: number): string[] {
      return [
        theme.fg("accent", "─".repeat(width)),
        " Press Enter to confirm, Escape to cancel",
        theme.fg("accent", "─".repeat(width)),
      ];
    },
    handleInput(data: string) {
      if (matchesKey(data, Key.enter)) done("confirmed");
      if (matchesKey(data, Key.escape)) done(null);
    },
    invalidate() {},
  };
});

if (result === "confirmed") {
  ctx.ui.notify("Confirmed!", "info");
}
```

### Обратный вызов фабрики

Фабричная функция получает четыре аргумента:

| Аргумент | Тип | Цель |
|----------|------|---------|
| `tui` | `TUI` | Информация на экране и управление рендерингом. `tui.requestRender()` запускает повторный рендеринг после изменения состояния. |
| `theme` | `Theme` | Текущая тема. Используйте `theme.fg()`, `theme.bg()`, `theme.bold()` и т. д. |
| `keybindings` | `KeybindingsManager` | Конфигурация привязки клавиш приложения. Для проверки того, какие клавиши что делают. |
| `done` | `(value: T) => void` | Вызовите это, чтобы закрыть компонент и вернуть значение ожидающему коду. |

### Использование существующих компонентов в качестве дочерних

```typescript
const result = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
  const container = new Container();
  container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
  container.addChild(new Text(theme.fg("accent", theme.bold("Title")), 1, 0));

  const selectList = new SelectList(items, 10, {
    selectedPrefix: (t) => theme.fg("accent", t),
    selectedText: (t) => theme.fg("accent", t),
    description: (t) => theme.fg("muted", t),
    scrollInfo: (t) => theme.fg("dim", t),
    noMatch: (t) => theme.fg("warning", t),
  });
  selectList.onSelect = (item) => done(item.value);
  selectList.onCancel = () => done(null);
  container.addChild(selectList);

  container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

  return {
    render: (w) => container.render(w),
    invalidate: () => container.invalidate(),
    handleInput: (data) => { selectList.handleInput(data); tui.requestRender(); },
  };
});
```

### Использование класса

```typescript
class MyComponent {
  private selected = 0;
  private items: string[];
  private done: (value: string | null) => void;
  private tui: { requestRender: () => void };
  private cachedWidth?: number;
  private cachedLines?: string[];

  constructor(tui: TUI, items: string[], done: (value: string | null) => void) {
    this.tui = tui;
    this.items = items;
    this.done = done;
  }

  handleInput(data: string) {
    if (matchesKey(data, Key.up) && this.selected > 0) {
      this.selected--;
      this.invalidate();
      this.tui.requestRender();
    } else if (matchesKey(data, Key.down) && this.selected < this.items.length - 1) {
      this.selected++;
      this.invalidate();
      this.tui.requestRender();
    } else if (matchesKey(data, Key.enter)) {
      this.done(this.items[this.selected]);
    } else if (matchesKey(data, Key.escape)) {
      this.done(null);
    }
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;
    this.cachedLines = this.items.map((item, i) => {
      const prefix = i === this.selected ? "> " : "  ";
      return truncateToWidth(prefix + item, width);
    });
    this.cachedWidth = width;
    return this.cachedLines;
  }

  invalidate() {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}

// Usage:
const result = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
  return new MyComponent(tui, ["Option A", "Option B", "Option C"], done);
});
```

---
