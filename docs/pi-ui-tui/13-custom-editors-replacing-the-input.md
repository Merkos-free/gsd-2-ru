# Пользовательские редакторы — замена ввода

Замените основной редактор ввода собственной реализацией. Редактор сохраняется до тех пор, пока его явно не удалят.

### Узор

```typescript
import { CustomEditor, type ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { matchesKey, truncateToWidth } from "@mariozechner/pi-tui";

class VimEditor extends CustomEditor {
  private mode: "normal" | "insert" = "insert";

  handleInput(data: string): void {
    // Escape in insert mode → switch to normal
    if (matchesKey(data, "escape") && this.mode === "insert") {
      this.mode = "normal";
      return;
    }

    // Insert mode: pass everything to CustomEditor for text editing + app keybindings
    if (this.mode === "insert") {
      super.handleInput(data);
      return;
    }

    // Normal mode: vim keys
    switch (data) {
      case "i": this.mode = "insert"; return;
      case "h": super.handleInput("\x1b[D"); return;  // Left arrow
      case "j": super.handleInput("\x1b[B"); return;  // Down arrow
      case "k": super.handleInput("\x1b[A"); return;  // Up arrow
      case "l": super.handleInput("\x1b[C"); return;  // Right arrow
    }

    // Filter printable chars in normal mode (don't insert them)
    if (data.length === 1 && data.charCodeAt(0) >= 32) return;

    // Pass unhandled to super (ctrl+c, ctrl+d, etc.)
    super.handleInput(data);
  }

  render(width: number): string[] {
    const lines = super.render(width);
    // Add mode indicator to last line
    if (lines.length > 0) {
      const label = this.mode === "normal" ? " NORMAL " : " INSERT ";
      const lastLine = lines[lines.length - 1]!;
      lines[lines.length - 1] = truncateToWidth(lastLine, width - label.length, "") + label;
    }
    return lines;
  }
}

// Register it:
export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    ctx.ui.setEditorComponent((_tui, theme, keybindings) =>
      new VimEditor(theme, keybindings)
    );
  });
}
```

### Критические правила

1. **Расширить `CustomEditor`**, а не `Editor`. `CustomEditor` обеспечивает привязку клавиш приложения (Escape для прерывания, Ctrl+D для выхода, переключение модели), которые нельзя потерять.
2. **Позвоните по номеру `super.handleInput(data)`**, если у вас нет ключа.
3. **Использовать заводской шаблон**: `setEditorComponent` получает заводской `(tui, theme, keybindings) => CustomEditor`.
4. **Нажмите `undefined`, чтобы восстановить настройки по умолчанию**: `ctx.ui.setEditorComponent(undefined)`.

---
