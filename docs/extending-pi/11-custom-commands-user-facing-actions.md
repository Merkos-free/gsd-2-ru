# Пользовательские команды — действия с пользователем


Команды позволяют пользователям вызывать ваше расширение напрямую через `/mycommand`.

```typescript
pi.registerCommand("deploy", {
  description: "Deploy to an environment",
  
  // Optional: argument auto-completion
  getArgumentCompletions: (prefix: string) => {
    const envs = ["dev", "staging", "prod"];
    return envs
      .filter(e => e.startsWith(prefix))
      .map(e => ({ value: e, label: e }));
  },
  
  handler: async (args, ctx) => {
    // args = everything after "/deploy "
    // ctx = ExtensionCommandContext (has extra session control methods)
    
    await ctx.waitForIdle();  // Wait for agent to finish
    ctx.ui.notify(`Deploying to ${args}`, "info");
  },
});
```

### Дополнительные возможности контекста команды

Обработчики команд получают `ExtensionCommandContext`, который расширяет `ExtensionContext`:

- `ctx.waitForIdle()` — Подождите, пока агент закончит
- `ctx.newSession(options?)` — Создать новый сеанс.
- `ctx.fork(entryId)` — Развилка от записи
- `ctx.navigateTree(targetId, options?)` — Навигация по дереву сеансов.
- `ctx.reload()` — Горячая перезагрузка всего

> **Важно!** Эти методы доступны только в командах, но не в обработчиках событий, поскольку там они могут привести к взаимоблокировке.

---
