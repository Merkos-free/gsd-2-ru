# Связь между внутренними номерами

Как расширения взаимодействуют друг с другом, обмениваются состоянием и координируют поведение.

---

## pi.events — общая шина событий

Каждое расширение получает один и тот же экземпляр `pi.events`. Это простой типизированный автобус-паб/суб.

### API

```typescript
// Emit an event on a channel
pi.events.emit("my-channel", { action: "started", id: 123 });

// Subscribe to a channel — returns an unsubscribe function
const unsub = pi.events.on("my-channel", (data) => {
  // data is typed as `unknown` — you must cast
  const payload = data as { action: string; id: number };
  console.log(payload.action); // "started"
});

// Later: stop listening
unsub();
```

### Характеристики

| Недвижимость | Поведение |
|---|---|
| **Ввод** | `data` - это `unknown`. Никаких дженериков. Бросьте на потребителя. |
| **Обработка ошибок** | Обработчики заключены в асинхронный метод try/catch. Ошибки регистрируются в `console.error`, но не распространяются на отправитель и не приводят к сбою сеанса. |
| **Заказ** | Обработчики срабатывают в порядке подписки (порядок вызовов `pi.events.on`). |
| **Настойчивость** | Никакого повторения, никакой настойчивости. Если вы отправите сообщение до того, как кто-либо подпишется, событие будет потеряно. |
| **Объем** | Совместно используется всеми расширениями ALL в сеансе. Шина создается один раз и передается на `createExtensionAPI` каждого расширения. |
| **Жизненный цикл** | Шина очищается при перезагрузке расширения (`/reload`). Подписки из старых экземпляров расширения исчезли. |

### Пример: внутренний номер A сигнализирует внутренний номер B

```typescript
// Extension A: plan-mode.ts
export default function (pi: ExtensionAPI) {
  pi.registerCommand("plan", {
    handler: async (_args, ctx) => {
      planEnabled = !planEnabled;
      pi.events.emit("mode-change", { mode: planEnabled ? "plan" : "normal" });
    },
  });
}

// Extension B: status-display.ts
export default function (pi: ExtensionAPI) {
  pi.events.on("mode-change", (data) => {
    const { mode } = data as { mode: string };
    // React to mode change
  });
}
```

### Ограничения

- **Нет запроса/ответа** — метод «выстрелил и забыл». Если вам нужен ответ, используйте общее состояние или шаблон обратного вызова.
- **Нет гарантированной доставки** — если подписчик еще не загрузился (порядок загрузки имеет значение), событие пропускается.
- **Нет пространства имен каналов** — используйте описательные имена каналов, чтобы избежать коллизий (например, `"myext:event"`, а не `"update"`).

---

## Шаблоны общего состояния

### Шаблон 1: общее состояние модуля

Если два расширения загружаются из одного и того же пакета (через массив `package.json` `pi.extensions`), они могут совместно использовать состояние через переменные уровня модуля в общем файле.

```
my-extension/
├── package.json    # pi.extensions: ["./a.ts", "./b.ts"]
├── a.ts            # import { state } from "./shared.ts"
├── b.ts            # import { state } from "./shared.ts"
└── shared.ts       # export const state = { count: 0 }
```

**Предупреждение:** кэширование модуля jiti означает, что общий модуль загружается один раз. Но в `/reload` всё импортируется с нуля — общий сброс состояния.

### Схема 2: Шина событий как канал состояния

Используйте `pi.events` для трансляции изменений состояния. Каждое расширение поддерживает свою собственную копию.

```typescript
// Extension A: authoritative state owner
let items: string[] = [];

function addItem(item: string) {
  items.push(item);
  pi.events.emit("items:updated", { items: [...items] });
}

// Extension B: state consumer
let mirroredItems: string[] = [];

pi.events.on("items:updated", (data) => {
  mirroredItems = (data as { items: string[] }).items;
});
```

### Схема 3: записи сеанса как точки координации

Расширения могут читать данные `appendEntry` друг друга из сеанса:

```typescript
// Extension A writes:
pi.appendEntry("ext-a-config", { theme: "dark", verbose: true });

// Extension B reads during session_start:
pi.on("session_start", async (_event, ctx) => {
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type === "custom" && entry.customType === "ext-a-config") {
      const config = entry.data as { theme: string; verbose: boolean };
      // Use config from Extension A
    }
  }
});
```

**Недостаток:** Это работает только после `session_start`. Не подходит для координации в реальном времени во время поворота.

---

## Шаблоны координации нескольких расширений

### Шаблон: Менеджер режимов

Одно расширение выступает в качестве органа управления режимом, другие реагируют:

```typescript
// mode-manager.ts — the authority
export default function (pi: ExtensionAPI) {
  let currentMode: "plan" | "execute" | "review" = "execute";
  
  pi.registerCommand("mode", {
    handler: async (args, ctx) => {
      const newMode = args.trim() as typeof currentMode;
      if (!["plan", "execute", "review"].includes(newMode)) {
        ctx.ui.notify(`Invalid mode: ${newMode}`, "error");
        return;
      }
      currentMode = newMode;
      pi.events.emit("mode:changed", { mode: currentMode });
      ctx.ui.notify(`Mode: ${currentMode}`);
    },
  });
  
  // Other extensions can query current mode via event
  pi.events.on("mode:query", () => {
    pi.events.emit("mode:current", { mode: currentMode });
  });
}

// tool-guard.ts — reacts to mode changes
export default function (pi: ExtensionAPI) {
  let currentMode = "execute";
  
  pi.events.on("mode:changed", (data) => {
    currentMode = (data as { mode: string }).mode;
  });
  
  pi.on("tool_call", async (event) => {
    if (currentMode === "plan" && ["edit", "write"].includes(event.toolName)) {
      return { block: true, reason: "Plan mode: write operations disabled" };
    }
    if (currentMode === "review" && event.toolName === "bash") {
      return { block: true, reason: "Review mode: bash disabled" };
    }
  });
}
```

### Шаблон: Цепочка приоритетов расширений

Когда несколько расширений обрабатывают один и тот же хук, порядок загрузки определяет приоритет. Локальные расширения проекта загружаются раньше глобальных. Внутри каталога файлы обнаруживаются в порядке файловой системы.

Если вам нужен явный контроль приоритета:

```typescript
// priority-extension.ts
export default function (pi: ExtensionAPI) {
  // Register with a known channel so other extensions can defer
  pi.events.emit("priority:registered", { name: "security-guard" });
  
  pi.on("tool_call", async (event) => {
    // This runs first if loaded first
    if (isUnsafe(event)) {
      return { block: true, reason: "Security policy violation" };
    }
  });
}
```

---

## Контекст расширения в инструментах

Инструменты, зарегистрированные расширениями, получают `ExtensionContext` в качестве пятого параметра `execute`. Это тот же самый контекст, который получают обработчики событий контекста:

```typescript
pi.registerTool({
  name: "my_tool",
  // ...
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // ctx.ui — dialog methods, notifications, widgets
    // ctx.sessionManager — read session state
    // ctx.model — current model
    // ctx.cwd — working directory
    // ctx.hasUI — false in print/json mode
    // ctx.isIdle() — agent state
    // ctx.abort() — abort current operation
    // ctx.getContextUsage() — token usage
    // ctx.compact() — trigger compaction
    // ctx.getSystemPrompt() — current system prompt
    
    if (ctx.hasUI) {
      const confirmed = await ctx.ui.confirm("Proceed?", "This will modify files");
      if (!confirmed) {
        return { content: [{ type: "text", text: "Cancelled by user" }] };
      }
    }
    
    // ... do work
  },
});
```

**Важно:** `ctx` создается заново с помощью `runner.createContext()` для каждого исполнения инструмента. Он отражает текущее состояние во время вызова (текущая модель, текущий сеанс и т. д.), а не состояние, когда инструмент был зарегистрирован.
