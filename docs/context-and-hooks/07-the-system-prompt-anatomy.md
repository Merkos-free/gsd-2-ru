# Анатомия системных подсказок

Как устроена системная подсказка Пи, что в нее входит, когда она перестраивается, и каждый рычаг, который вам нужен для ее формирования.

---

## Окончательная структура приглашения

При запуске `buildSystemPrompt()` разделы собираются именно в таком порядке:

```
┌──────────────────────────────────────────────────┐
│ 1. Base prompt (default or SYSTEM.md override)   │
│    ├── Identity statement                        │
│    ├── Available tools list                      │
│    ├── Custom tools note                         │
│    ├── Guidelines                                │
│    └── Pi documentation pointers                 │
│                                                  │
│ 2. Append system prompt (APPEND_SYSTEM.md)       │
│                                                  │
│ 3. Project context files                         │
│    ├── ~/.gsd/agent/AGENTS.md (global)            │
│    ├── Ancestor AGENTS.md / CLAUDE.md files      │
│    └── cwd AGENTS.md / CLAUDE.md                 │
│                                                  │
│ 4. Skills listing                                │
│    └── <available_skills> XML block              │
│                                                  │
│ 5. Date/time and working directory               │
└──────────────────────────────────────────────────┘
```

После `buildSystemPrompt()` расширения могут быть изменены с помощью `before_agent_start`.

---

## Раздел 1: Базовая подсказка

### Базовая подсказка по умолчанию (без SYSTEM.md)

Когда SYSTEM.md не существует, число pi использует встроенную базу:

```
You are an expert coding assistant operating inside pi, a coding agent harness.
You help users by reading files, executing commands, editing code, and writing new files.

Available tools:
- read: Read file contents
- bash: Execute bash commands (ls, grep, find, etc.)
- edit: Make surgical edits to files (find exact text and replace)
- write: Create or overwrite files
- my_custom_tool: [promptSnippet or description]

In addition to the tools above, you may have access to other custom tools
depending on the project.

Guidelines:
- Use bash for file operations like ls, rg, find
- Use read to examine files before editing. You must use this tool instead of cat or sed.
- Use edit for precise changes (old text must match exactly)
- Use write only for new files or complete rewrites
- [extension tool promptGuidelines inserted here]
- Be concise in your responses
- Show file paths clearly when working with files

Pi documentation (read only when the user asks about pi itself...):
- Main documentation: [path]
- Additional docs: [path]
- Examples: [path]
```

### SYSTEM.md Override (полная замена)

Если существует `.gsd/SYSTEM.md` (проект) или `~/.gsd/agent/SYSTEM.md` (глобальный), его содержимое **полностью заменяет** базовое приглашение по умолчанию, указанное выше. Список инструментов, рекомендации, указатели на Pi-документы — все исчезло. Вы владеете всей базой.

Проект имеет приоритет над глобальным. Используется только один SYSTEM.md (выигрыш, найденный первым).

**Что по-прежнему добавляется даже при использовании пользовательского SYSTEM.md:**
- APPEND_SYSTEM.md контента
- Файлы контекста проекта (AGENTS.md / CLAUDE.md)
- Список навыков (если инструмент `read` активен)
- Дата/время и cwd

**Что вы теряете:**
- Вся структура подсказок по умолчанию.
- Встроенные описания и рекомендации инструментов.
- Указатели документации Pi
- Динамические рекомендации из `promptGuidelines` по инструментам.

### Как появляются описания инструментов

Каждый активный инструмент получает строку в разделе «Доступные инструменты»:

```
- toolname: [one-line description]
```

Описание определяется приоритетом:
1. `promptSnippet` от регистрации инструмента (если предусмотрено)
2. Встроенное описание из карты `toolDescriptions` (для чтения, bash, редактирования, записи, grep, find, ls)
3. Инструмент `name` в качестве запасного варианта.

`promptSnippet` нормализуется: символы новой строки свернуты в пробелы и обрезаны до одной строки.

### Как создаются рекомендации

Рекомендации собираются динамически в зависимости от того, какие инструменты активны:

| Состояние | Руководство |
|---|---|
| bash активен, нет grep/find/ls | «Используйте bash для операций с файлами, таких как ls, rg, find» |
| bash active + grep/find/ls | «Для исследования файлов предпочитайте инструменты grep/find/ls, а не bash» |
| читать + редактировать активно | «Используйте чтение для проверки файлов перед редактированием» |
| редактировать активный | «Используйте редактирование для точных изменений (старый текст должен точно совпадать)» |
| писать активно | «Использовать запись только для новых файлов или полной перезаписи» |
| редактировать или писать активно | «При подведении итогов своих действий выводите простой текст напрямую» |
| Всегда | «Будьте краткими в своих ответах» |
| Всегда | «Четкое отображение путей к файлам при работе с файлами» |

**Инструкции по инструментам расширения** из `promptGuidelines` добавляются после встроенных рекомендаций. Они дедуплицированы (одна и та же строка появляется только один раз, даже если ее зарегистрировали несколько инструментов).

---

## Раздел 2: Добавление системной подсказки

Если `.gsd/APPEND_SYSTEM.md` (проект) или `~/.gsd/agent/APPEND_SYSTEM.md` (глобальный) существует, его содержимое добавляется после основного приглашения.

Это безопасный способ добавления инструкций для всего проекта без замены приглашения по умолчанию. Он работает как с базой по умолчанию, так и с пользовательской SYSTEM.md.

---

## Раздел 3: Файлы контекста проекта

Пи обходит файловую систему, собирая файлы контекста:

```
1. ~/.gsd/agent/AGENTS.md (global)
2. Walk from cwd upward to root:
   - Each directory: check for AGENTS.md, then CLAUDE.md (first found wins per directory)
   - Files are collected root-down (ancestors first, cwd last)
```

Все найденные файлы объединяются под заголовком «# Project Context»:

```markdown
# Project Context

Project-specific instructions and guidelines:

## /Users/you/.gsd/agent/AGENTS.md

[global AGENTS.md content]

## /Users/you/projects/myapp/AGENTS.md

[project AGENTS.md content]
```

**AGENTS.md против CLAUDE.md:** Оба обрабатываются одинаково. В каждом каталоге сначала проверяется AGENTS.md. Если он существует, CLAUDE.md в том же каталоге пропускается.

---

## Раздел 4: Список навыков

Если инструмент `read` активен и навыки загружены, добавляется блок XML:

```xml
The following skills provide specialized instructions for specific tasks.
Use the read tool to load a skill's file when the task matches its description.
When a skill file references a relative path, resolve it against the skill directory.

<available_skills>
  <skill>
    <name>commit-outstanding</name>
    <description>Commit all uncommitted files in logical groups</description>
    <location>/Users/you/.gsd/agent/skills/commit-outstanding/SKILL.md</location>
  </skill>
</available_skills>
```

Навыки с `disable-model-invocation: true` в названии исключены из этого списка.

**Дизайн ключа:** в системную подсказку попадают только имена, описания и пути к файлам. Полный контент навыков загружен NOT. Агент использует инструмент `read` для загрузки определенных навыков по требованию. Благодаря этому системное приглашение остается небольшим даже при наличии многих навыков.

---

## Раздел 5: Дата/время и CWD

Всегда добавляется последним:

```
Current date and time: Saturday, March 7, 2026 at 08:55:05 AM CST
Current working directory: /Users/you/projects/myapp
```

---

## Когда системная подсказка перестроена

Подсказка базовой системы (`_baseSystemPrompt`) перестраивается в следующих ситуациях:

| Триггер | Что происходит |
|---|---|
| **Запуск** (`_buildRuntime`) | Полный ремонт с использованием первоначального набора инструментов |
| **`setActiveToolsByName()`** | Перестройка с использованием нового набора инструментов (изменения в руководствах и фрагментах) |
| **`reload()`** (`/reload`) | Полный ребилд — перезагрузка SYSTEM.md, APPEND_SYSTEM.md, контекстных файлов, навыков, расширений |
| **`extendResourcesFromExtensions()`** | Восстановление после `resources_discover` добавляет новые навыки/подсказки/темы |
| **`_refreshToolRegistry()`** | Перестроить, когда инструменты расширения изменяются динамически |

### Изменения для каждого запроса

В каждом приглашении пользователя перехватчик `before_agent_start` может изменить системное приглашение. Это изменение **не сохраняется** — базовое приглашение восстанавливается, если никакое расширение не изменяет его в следующем приглашении:

```
User prompt 1:
  before_agent_start → extensions modify system prompt → LLM sees modified version

User prompt 2:
  before_agent_start → no extensions modify → LLM sees base system prompt (reset)
```

Это означает, что изменения `before_agent_start` действительно выполняются по запросу. Вы не можете внести постоянное изменение системного приглашения только с помощью этого хука (изменение необходимо применять повторно каждый раз).

---

## Каждый рычаг для формирования системной подсказки

От статической конфигурации до динамических расширений, в порядке от самого широкого до наиболее целевого:

### Статический (файловый, загружается при запуске)

| Механизм | Область применения | Эффект |
|---|---|---|
| `SYSTEM.md` | Заменить базовую подсказку полностью | Ядерный вариант — все принадлежит вам |
| `APPEND_SYSTEM.md` | Добавить в базовую подсказку | Инструкции по безопасным добавкам |
| `AGENTS.md` / `CLAUDE.md` | Раздел контекста проекта | Соглашения и правила для каждого проекта |
| Файлы навыков `SKILL.md` | Список навыков | Описания возможностей по требованию |

### Динамический (на основе расширений, среда выполнения)

| Механизм | Область применения | Тайминг | Эффект |
|---|---|---|---|
| `before_agent_start` → `systemPrompt` | Полная подсказка | Запрос пользователя | Изменить/добавить/заменить системное приглашение |
| `promptSnippet` об инструментах | Строка описания инструмента | Когда меняется набор инструментов | Пользовательская однострочная строка в «Доступных инструментах» |
| `promptGuidelines` об инструментах | Раздел «Рекомендации» | Когда меняется набор инструментов | Добавьте поведенческие маркеры |
| `pi.setActiveTools()` | Список инструментов + рекомендации | Немедленно, следующая подсказка | Добавить/удалить инструменты (подсказка перестроить) |
| `resources_discover` событие | Список навыков | Запуск + перезагрузка | Внедрить дополнительные навыки из расширений |

### За ход (на основе сообщений, а не системных подсказок)

Они не изменяют системное приглашение, а добавляют к тому, что видит LLM:

| Механизм | Тайминг | Эффект |
|---|---|---|
| `before_agent_start` → `message` | Запрос пользователя | Внедрить пользовательское сообщение (становится ролью пользователя) |
| `context` событие | За ход LLM | Фильтровать/внедрить/преобразовать массив сообщений |
| `pi.sendMessage()` | В любое время | Вставить собственное сообщение в разговор |

---

## Практические компромиссы

### SYSTEM.md против before_agent_start

| | SYSTEM.md | before_agent_start |
|---|---|---|
| **Настойчивость** | Постоянно до изменения файла | По запросу необходимо повторно подать заявку |
| **Динамизм** | Статическое содержимое файла | Может выполнять вычисления на основе состояния |
| **Информация об инструментах** | Теряет встроенные рекомендации по инструменту | Сохраняет базовое приглашение, добавляет |
| **Компоновываемость** | Только один SYSTEM.md (проектный или глобальный) | Несколько расширений могут объединяться |

**Рекомендация.** Используйте SYSTEM.md только в том случае, если вам действительно необходимо заменить всю подсказку (например, персонализированная личность агента, вариант использования без кодирования). Для всего остального используйте `before_agent_start`.

### APPEND_SYSTEM.md против AGENTS.md

Оба добавляют контент, но появляются в разных разделах:

- **APPEND_SYSTEM.md** появляется сразу после основного приглашения, перед «# Project Context».
- **AGENTS.md** отображается внутри «# контекста проекта» с заголовком `## filepath`.

Функционально эквивалентен LLM. Используйте APPEND_SYSTEM.md для инструкций, которые похожи на директивы системного уровня. Используйте AGENTS.md для обозначения условных обозначений и контекста, специфичных для проекта.

### promptGuidelines против before_agent_start

| | promptGuidelines | before_agent_start |
|---|---|---|
| **Объем** | Только когда инструмент активен | Всегда (или условно в вашем коде) |
| **Позиционирование** | Внутри раздела «Рекомендации» | Добавлено в конец (или где бы вы его ни поставили) |
| **Соединение инструмента** | Автоматически появляется/исчезает с помощью инструмента | Независимость от состояния инструмента |

**Рекомендация.** Используйте `promptGuidelines` для получения инструкций, непосредственно связанных с использованием инструмента. Используйте `before_agent_start` для изменения поведения независимо от состояния инструмента.

---

## Полная область контекста

Все, что LLM видит на данном ходу:

```
System prompt (built from all sources above + before_agent_start mods)
  +
Message array (after context event filtering + convertToLlm):
  - Compaction summaries (user role)
  - Branch summaries (user role)
  - Historical user/assistant/toolResult messages
  - Bash execution results (user role, unless !! excluded)
  - Custom messages from extensions (user role)
  - Current prompt + before_agent_start injected messages
  +
Tool definitions:
  - name, description, parameter JSON schema
  - Only for active tools (pi.getActiveTools())
```

Понимание всей этой площади поверхности — и того, какие рычаги управляют какими частями — является ключом к эффективному контекстному проектированию в пи.
