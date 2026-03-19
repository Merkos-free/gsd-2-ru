# ExtensionContext — к чему вы можете получить доступ


Каждый обработчик событий получает `ctx: ExtensionContext`. Это ваше окно в состояние выполнения pi.

### ctx.ui — взаимодействие с пользователем

Основной способ взаимодействия с пользователем. Подробную информацию см. в [Раздел 12: Пользовательский UI](#12-custom-ui--visual-components).

```typescript
// Dialogs (blocking, wait for user response)
const choice = await ctx.ui.select("Pick one:", ["A", "B", "C"]);
const ok = await ctx.ui.confirm("Delete?", "This cannot be undone");
const name = await ctx.ui.input("Name:", "placeholder");
const text = await ctx.ui.editor("Edit:", "prefilled text");

// Non-blocking UI
ctx.ui.notify("Done!", "info");           // Toast notification
ctx.ui.setStatus("my-ext", "Active");     // Footer status
ctx.ui.setWidget("my-id", ["Line 1"]);    // Widget above/below editor
ctx.ui.setTitle("pi - my project");       // Terminal title
ctx.ui.setEditorText("Prefill text");     // Set editor content
ctx.ui.setWorkingMessage("Thinking...");  // Working message during streaming
```

### ctx.hasUI

`false` в режиме печати (`-p`) и JSON. `true` в интерактивном режиме и RPC. Всегда проверяйте перед вызовом методов диалога в неинтерактивном контексте.

### ctx.cwd

Текущий рабочий каталог (строка).

### ctx.sessionManager — Состояние сеанса

Доступ к сессии только для чтения:

```typescript
ctx.sessionManager.getEntries()       // All entries in session
ctx.sessionManager.getBranch()        // Current branch entries
ctx.sessionManager.getLeafId()        // Current leaf entry ID
ctx.sessionManager.getSessionFile()   // Path to session JSONL file
ctx.sessionManager.getLabel(entryId)  // Get label on entry
```

### ctx.modelRegistry / ctx.model

Доступ к доступным моделям и текущей модели.

### ctx.isIdle() / ctx.abort() / ctx.hasPendingMessages()

Помощники потока управления для проверки состояния агента.

### ctx.shutdown()

Запросите плавное завершение работы. Отложено до тех пор, пока агент не освободится. Перед выходом издает `session_shutdown`.

### ctx.getContextUsage()

Возвращает текущее использование токена контекста. Полезно для запуска сжатия или отображения статистики.

```typescript
const usage = ctx.getContextUsage();
if (usage && usage.tokens > 100_000) {
  // Context is getting large
}
```

### ctx.compact(варианты?)

Запустите сжатие программно:

```typescript
ctx.compact({
  customInstructions: "Focus on recent changes",
  onComplete: (result) => ctx.ui.notify("Compacted!", "info"),
  onError: (error) => ctx.ui.notify(`Failed: ${error.message}`, "error"),
});
```

### ctx.getSystemPrompt()

Возвращает текущее действующее системное приглашение (включая любые изменения `before_agent_start`).

---
