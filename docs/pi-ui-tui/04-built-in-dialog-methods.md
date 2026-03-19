# Встроенные методы диалога

Самый простой UI — блокировка диалогов, ожидающих ответа пользователя:

### Выбор

```typescript
const choice = await ctx.ui.select("Pick a color:", ["Red", "Green", "Blue"]);
// Returns: "Red" | "Green" | "Blue" | undefined (if cancelled)
```

### Подтверждение

```typescript
const ok = await ctx.ui.confirm("Delete file?", "This action cannot be undone.");
// Returns: true | false
```

### Ввод текста

```typescript
const name = await ctx.ui.input("Project name:", "my-project");
// Returns: string | undefined (if cancelled)
```

### Многострочный редактор

```typescript
const text = await ctx.ui.editor("Edit the description:", "Default text here");
// Returns: string | undefined (if cancelled)
```

### Диалоги по времени (автоматическое закрытие)

Диалоги могут автоматически закрываться с обратным отсчетом в реальном времени:

```typescript
// Shows "Confirm? (5s)" → "Confirm? (4s)" → ... → auto-dismisses
const ok = await ctx.ui.confirm(
  "Auto-proceed?",
  "Continuing in 5 seconds...",
  { timeout: 5000 }
);
// Returns false on timeout
```

**Возвращаемые значения тайм-аута:**
- `select()` → `undefined`
- `confirm()` → `false`
- `input()` → `undefined`

### Ручное увольнение с помощью AbortSignal

Для большего контроля (отличайте тайм-аут от отмены пользователя):

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);

const ok = await ctx.ui.confirm(
  "Timed Confirm",
  "Auto-cancels in 5s",
  { signal: controller.signal }
);

clearTimeout(timeoutId);

if (ok) {
  // User confirmed
} else if (controller.signal.aborted) {
  // Timed out
} else {
  // User cancelled (Escape)
}
```

---
