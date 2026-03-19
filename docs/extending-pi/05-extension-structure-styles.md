# Структура и стили расширения


### Один файл (самый простой)

```
~/.gsd/agent/extensions/
└── my-extension.ts
```

### Каталог с index.ts (многофайловый)

```
~/.gsd/agent/extensions/
└── my-extension/
    ├── index.ts        # Entry point (must export default function)
    ├── tools.ts
    └── utils.ts
```

### Пакет с зависимостями (необходимы пакеты npm)

```
~/.gsd/agent/extensions/
└── my-extension/
    ├── package.json
    ├── package-lock.json
    ├── node_modules/
    └── src/
        └── index.ts
```

```json
// package.json
{
  "name": "my-extension",
  "dependencies": { "zod": "^3.0.0" },
  "pi": { "extensions": ["./src/index.ts"] }
}
```

Запустите `npm install` в каталоге расширения. Импорт из `node_modules/` разрешается автоматически.

### Доступный импорт

| Пакет | Цель |
|---------|---------|
| `@mariozechner/pi-coding-agent` | Типы расширений (`ExtensionAPI`, `ExtensionContext`, типы событий, утилиты) |
| `@sinclair/typebox` | Определения схем для параметров инструмента (`Type.Object`, `Type.String` и т. д.) |
| `@mariozechner/pi-ai` | Утилиты AI (`StringEnum` для перечислений, совместимых с Google) |
| `@mariozechner/pi-tui` | Компоненты TUI (`Text`, `Box`, `Container`, `SelectList` и т.д.) |
| Node.js встроенные | `node:fs`, `node:path`, `node:child_process` и т.д. |

---
