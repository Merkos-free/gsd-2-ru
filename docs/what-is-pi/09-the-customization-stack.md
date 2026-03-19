# Стек настройки

Pi имеет четыре уровня настройки, каждый из которых служит своей цели:

```
┌─────────────────────────────────────┐
│           Extensions                │  ← TypeScript code. Full runtime access.
│  Custom tools, events, UI,          │     Can do anything.
│  commands, providers                │
├─────────────────────────────────────┤
│           Skills                    │  ← Markdown instructions + scripts.
│  On-demand capability packages      │     Loaded when the task matches.
│  loaded by the agent                │
├─────────────────────────────────────┤
│       Prompt Templates              │  ← Markdown snippets.
│  Reusable prompts expanded          │     Quick text expansion via /name.
│  via /templatename                  │
├─────────────────────────────────────┤
│           Themes                    │  ← JSON color definitions.
│  Visual appearance                  │     Hot-reload on change.
└─────────────────────────────────────┘
```

### Расширения

Модули TypeScript с полным доступом во время выполнения. Они могут подключаться к каждому событию, регистрировать инструменты, которые может вызывать LLM, добавлять команды, отображать пользовательские UI, переопределять встроенное поведение и регистрировать поставщиков моделей. Расширения — это самый мощный механизм настройки.

**Размещение:**
- `~/.gsd/agent/extensions/` (глобальный)
- `.gsd/extensions/` (локальный проект)

Полный справочник размером 50 КБ см. в сопутствующем документе **Pi-Extensions-Complete-Guide.md**.

### Навыки

Пакеты возможностей по требованию, соответствующие [стандарту навыков агента] (https://agentskills.io). Навык — это каталог с файлом `SKILL.md`, содержащим инструкции, которым следует оператор. Навыки прогрессивные: в системной подсказке есть только их названия и описания. Агент считывает SKILL.md полностью только в том случае, если задача соответствует.

**Как работают навыки:**
1. При запуске pi сканирует навыки и извлекает имена + описания.
2. Описания указаны в системной подсказке.
3. При совпадении задачи агент использует `read` для загрузки полной SKILL.md.
4. Агент следует инструкциям, используя относительные пути для скриптов/активов.

**Призыв:**
```
/skill:brave-search              # Explicit invocation
/skill:pdf-tools extract file.pdf  # With arguments
```

**Размещение:**
- `~/.gsd/agent/skills/` или `~/.agents/skills/` (глобальный)
- `.gsd/skills/` или `.agents/skills/` (проект, поиск до корня git)

**Структура навыков:**
```
my-skill/
├── SKILL.md              # Required: frontmatter + instructions
├── scripts/              # Helper scripts (optional)
│   └── process.sh
└── references/           # Reference docs (optional)
    └── api-guide.md
```

### Шаблоны подсказок

Файлы Markdown, которые превращаются в подсказки с помощью `/name`. Простое расширение текста с поддержкой позиционных аргументов (`$1`, `$2`, `$@`).

```markdown
<!-- ~/.gsd/agent/prompts/review.md -->
---
description: Review staged git changes
---
Review the staged changes (`git diff --cached`). Focus on:
- Bugs and logic errors  
- Security issues
- Performance problems
Focus area: $1
```

Использование: `/review "error handling"` → расширяется с помощью `$1` = «обработка ошибок».

**Размещение:**
- `~/.gsd/agent/prompts/` (глобальный)
- `.gsd/prompts/` (локальный проект)

### Темы

Файлы JSON, определяющие цветовую палитру для TUI. Горячая перезагрузка: отредактируйте файл, и pi немедленно применит изменения.

**Встроенные:** `dark`, `light`

**Размещение:**
- `~/.gsd/agent/themes/` (глобальный)
- `.gsd/themes/` (локальный проект)

---
