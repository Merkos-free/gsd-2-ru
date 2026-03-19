# Постоянные элементы UI

Они остаются на экране до тех пор, пока не будут явно удалены:

### Статус (нижний колонтитул)

```typescript
// Set (persists until cleared or overwritten)
ctx.ui.setStatus("my-ext", "● Active");
ctx.ui.setStatus("my-ext", ctx.ui.theme.fg("accent", "● Mode: Plan"));

// Clear
ctx.ui.setStatus("my-ext", undefined);
```

Несколько расширений могут устанавливать независимые записи статуса. Они появляются в нижнем колонтитуле.

### Виджеты (над/ниже редактора)

```typescript
// Simple string array (above editor, default)
ctx.ui.setWidget("my-widget", ["Line 1", "Line 2", "Line 3"]);

// Below editor
ctx.ui.setWidget("my-widget", ["Below the editor!"], { placement: "belowEditor" });

// With theme (component factory)
ctx.ui.setWidget("my-widget", (_tui, theme) => {
  const lines = items.map(item =>
    item.done
      ? theme.fg("success", "✓ ") + theme.fg("muted", theme.strikethrough(item.text))
      : theme.fg("dim", "○ ") + item.text
  );
  return {
    render: () => lines,
    invalidate: () => {},
  };
});

// Clear
ctx.ui.setWidget("my-widget", undefined);
```

### Рабочее сообщение (во время потоковой передачи)

```typescript
ctx.ui.setWorkingMessage("Analyzing code structure...");
ctx.ui.setWorkingMessage();  // Restore default
```

### Пользовательский нижний колонтитул (полная замена)

```typescript
ctx.ui.setFooter((tui, theme, footerData) => ({
  invalidate() {},
  render(width: number): string[] {
    const branch = footerData.getGitBranch();  // Not accessible elsewhere!
    const statuses = footerData.getExtensionStatuses();  // All setStatus values
    const left = theme.fg("dim", `${ctx.model?.id || "no-model"}`);
    const right = theme.fg("dim", branch || "no git");
    const pad = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));
    return [truncateToWidth(left + pad + right, width)];
  },
  // Reactive: re-render when branch changes
  dispose: footerData.onBranchChange(() => tui.requestRender()),
}));

// Restore default
ctx.ui.setFooter(undefined);
```

**`footerData` обеспечивает:**
- `getGitBranch(): string | null` — текущая ветка git (недоступна через любой другой API)
- `getExtensionStatuses(): ReadonlyMap<string, string>` — все значения `setStatus`
- `onBranchChange(callback): () => void` — подписаться на изменения ветки, возвращает функцию удаления

### Пользовательский заголовок

```typescript
ctx.ui.setHeader((tui, theme) => ({
  render(width: number): string[] {
    return [theme.fg("accent", theme.bold("My Custom Header"))];
  },
  invalidate() {},
}));
```

### Управление редактором

```typescript
// Set editor text
ctx.ui.setEditorText("Prefilled text for the user");

// Get current editor text
const current = ctx.ui.getEditorText();

// Paste into editor (triggers paste handling, including collapse for large content)
ctx.ui.pasteToEditor("pasted content");

// Tool output expansion
const wasExpanded = ctx.ui.getToolsExpanded();
ctx.ui.setToolsExpanded(true);   // Expand all
ctx.ui.setToolsExpanded(false);  // Collapse all

// Terminal title
ctx.ui.setTitle("pi - my project");
```

### Управление темами

```typescript
const themes = ctx.ui.getAllThemes();       // [{ name: "dark", path: ... }, ...]
const lightTheme = ctx.ui.getTheme("light");  // Load without switching
const result = ctx.ui.setTheme("light");      // Switch by name
if (!result.success) ctx.ui.notify(result.error!, "error");
ctx.ui.setTheme(lightTheme!);               // Switch by Theme object
ctx.ui.theme.fg("accent", "styled text");    // Access current theme
```

---
