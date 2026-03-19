# Конфигурация

Предпочтения GSD хранятся в `~/.gsd/preferences.md` (глобально) или `.gsd/preferences.md` (локально для проекта). Управляйте интерактивно с помощью `/gsd prefs`.

## `/gsd prefs` Команды

| Команда | Описание |
|---------|-------------|
| `/gsd prefs` | Открыть мастер глобальных настроек (по умолчанию) |
| `/gsd prefs global` | Интерактивный мастер глобальных настроек (`~/.gsd/preferences.md`) |
| `/gsd prefs project` | Интерактивный мастер настроек проекта (`.gsd/preferences.md`) |
| `/gsd prefs status` | Показать текущие файлы настроек, объединенные значения и статус разрешения навыков |
| `/gsd prefs wizard` | Псевдоним `/gsd prefs global` |
| `/gsd prefs setup` | Псевдоним для `/gsd prefs wizard` — создает файл настроек, если он отсутствует |
| `/gsd prefs import-claude` | Импортируйте плагины и навыки Claude Marketplace как компоненты с пространством имен GSD |
| `/gsd prefs import-claude global` | Импорт в глобальную область |
| `/gsd prefs import-claude project` | Импорт в объем проекта |

## Формат файла настроек

В настройках в файле уценки используется заголовок YAML:

```yaml
---
version: 1
models:
  research: claude-sonnet-4-6
  planning: claude-opus-4-6
  execution: claude-sonnet-4-6
  completion: claude-sonnet-4-6
skill_discovery: suggest
auto_supervisor:
  soft_timeout_minutes: 20
  idle_timeout_minutes: 10
  hard_timeout_minutes: 30
budget_ceiling: 50.00
token_profile: balanced
---
```

## Глобальные и проектные настройки

| Область применения | Путь | Применяется к |
|-------|------|-----------|
| Глобальный | `~/.gsd/preferences.md` | Все проекты |
| Проект | `.gsd/preferences.md` | Только текущий проект |

**Поведение при слиянии:**
- **Скалярные поля** (`skill_discovery`, `budget_ceiling`): проект выигрывает, если они определены.
- **Поля массива** (`always_use_skills` и т. д.): объединены (сначала глобальные, затем проектные).
- **Поля объектов** (`models`, `git`, `auto_supervisor`): поверхностное объединение, переопределение проекта для каждой клавиши.

## Глобальные клавиши API (`/gsd config`)

Ключи инструмента API хранятся глобально в `~/.gsd/agent/auth.json` и автоматически применяются ко всем проектам. Установите их один раз с помощью `/gsd config` — нет необходимости настраивать файлы `.env` для каждого проекта.

```bash
/gsd config
```

Откроется интерактивный мастер, показывающий, какие ключи настроены, а какие отсутствуют. Выберите инструмент, чтобы ввести его ключ.

### Поддерживаемые ключи

| Инструмент | Переменная среды | Цель | Получить ключ |
|------|---------------------|---------|-----------|
| Тавили Поиск | `TAVILY_API_KEY` | Веб-поиск неантропных моделей | [tavily.com/app/api-keys](https://tavily.com/app/api-keys) |
| Смелый поиск | `BRAVE_API_KEY` | Веб-поиск неантропных моделей | [brave.com/search/api](https://brave.com/search/api) |
| Документы Context7 | `CONTEXT7_API_KEY` | Поиск документации по библиотеке | [context7.com/dashboard](https://context7.com/dashboard) |

### Как это работает

1. `/gsd config` сохраняет ключи в `~/.gsd/agent/auth.json`.
2. При каждом запуске сеанса `loadToolApiKeys()` читает файл и устанавливает переменные среды.
3. Ключи применяются ко всем проектам — настройка для каждого проекта не требуется.
4. Переменные среды (`export BRAVE_API_KEY=...`) имеют приоритет над сохраненными ключами.
5. Антропным моделям не нужен Brave/Tavily — у них есть встроенный веб-поиск.

## Все настройки

### `models`

Пофазный выбор модели. Каждый ключ принимает строку модели или объект с резервными вариантами.

```yaml
models:
  research: claude-sonnet-4-6
  planning:
    model: claude-opus-4-6
    fallbacks:
      - openrouter/z-ai/glm-5
  execution: claude-sonnet-4-6
  execution_simple: claude-haiku-4-5-20250414
  completion: claude-sonnet-4-6
  subagent: claude-sonnet-4-6
```

**Фазы:** `research`, `planning`, `execution`, `execution_simple`, `completion`, `subagent`

- `execution_simple` — используется для задач, классифицированных как «простые» [маршрутизатором сложности] (./token-optimization.md#complexity-based-task-routing)
- `subagent` — модель делегирования задач субагенту (разведчик, исследователь, рабочий)
– Таргетинг на поставщика: используйте формат `provider/model` (например, `bedrock/claude-sonnet-4-6`) или поле `provider` в формате объекта.
- Опустите клавишу, чтобы использовать любую активную в данный момент модель.

### Определения пользовательских моделей (`models.json`)

Определите пользовательские модели в `~/.gsd/agent/models.json`. Это позволяет добавлять модели, не включенные в реестр по умолчанию, что полезно для автономных конечных точек, точно настроенных моделей или новых выпусков.

GSD разрешает models.json с запасной логикой:
1. `~/.gsd/agent/models.json` — первичный (GSD)
2. `~/.pi/agent/models.json` — запасной вариант (Пи)
3. Если ни одного из них не существует, создается `~/.gsd/agent/models.json`.

**С резервными вариантами:**

```yaml
models:
  planning:
    model: claude-opus-4-6
    fallbacks:
      - openrouter/z-ai/glm-5
      - openrouter/moonshotai/kimi-k2.5
    provider: bedrock    # optional: target a specific provider
```

Если модель не удается переключиться (провайдер недоступен, тариф ограничен, кредиты исчерпаны), GSD автоматически пробует следующую модель в списке `fallbacks`.

### Расширения поставщиков сообщества

Для провайдеров, не встроенных в GSD, расширения сообщества могут добавить полную поддержку провайдеров с правильными определениями моделей, конфигурацией формата мышления и интерактивной настройкой ключей API.

| Расширение | Провайдер | Модели | Установить |
|-----------|----------|--------|---------|
| [`pi-dashscope`](https://www.npmjs.com/package/pi-dashscope) ​​| Alibaba DashScope (ModelStudio) | Qwen3, GLM-5, MiniMax M2.5, Кими K2.5 | `gsd install npm:pi-dashscope` |

Расширения сообщества рекомендуется использовать вместо встроенного поставщика `alibaba-coding-plan` для моделей DashScope — они используют правильную конечную точку, совместимую с OpenAI, и включают флаги совместимости для каждой модели для режима мышления.

### `token_profile`

Координирует выбор модели, пропуск фаз и сжатие контекста. См. [Оптимизация токена](./token-optimization.md).

Значения: `budget`, `balanced` (по умолчанию), `quality`

| Профиль | Поведение |
|---------|----------|
| `budget` | Пропускает этапы исследования и переоценки, использует более дешевые модели |
| `balanced` | Поведение по умолчанию — выполняются все этапы, выбор стандартной модели |
| `quality` | Все этапы выполняются, предпочитает модели более высокого качества |

### `phases`

Точный контроль над тем, какие фазы выполняются в автоматическом режиме:

```yaml
phases:
  skip_research: false        # skip milestone-level research
  skip_reassess: false        # skip roadmap reassessment after each slice
  skip_slice_research: true   # skip per-slice research
  require_slice_discussion: false  # pause auto-mode before each slice for discussion
```

Обычно они устанавливаются автоматически с помощью `token_profile`, но их можно явно отменить.

### `skill_discovery`

Управляет тем, как GSD находит и применяет навыки в автоматическом режиме.

| Значение | Поведение |
|-------|----------|
| `auto` | Навыки обнаруживаются и применяются автоматически |
| `suggest` | Навыки, выявленные в ходе исследования, но не установленные автоматически (по умолчанию) |
| `off` | Открытие навыков отключено |

### `auto_supervisor`

Пороги времени ожидания для контроля автоматического режима:

```yaml
auto_supervisor:
  model: claude-sonnet-4-6    # optional: model for supervisor (defaults to active model)
  soft_timeout_minutes: 20    # warn LLM to wrap up
  idle_timeout_minutes: 10    # detect stalls
  hard_timeout_minutes: 30    # pause auto mode
```

### `budget_ceiling`

Максимальная сумма в USD, которую можно потратить в автоматическом режиме. Без знака `$` — только число.

```yaml
budget_ceiling: 50.00
```

### `budget_enforcement`

Как обеспечивается соблюдение верхнего предела бюджета:

| Значение | Поведение |
|-------|----------|
| `warn` | Записать предупреждение, но продолжить |
| `pause` | Автоматический режим паузы (по умолчанию, если установлен потолок) |
| `halt` | Полностью отключить автоматический режим |

### `context_pause_threshold`

Процент использования контекстного окна (0–100), при котором автоматический режим приостанавливается для проверки контрольной точки. Установите значение `0` для отключения.

```yaml
context_pause_threshold: 80   # pause at 80% context usage
```

По умолчанию: `0` (отключено)

### `uat_dispatch`

Включить автоматический запуск UAT (приемочного теста пользователя) после завершения среза:

```yaml
uat_dispatch: true
```

### Проверка (v2.26)

Настройте команды оболочки, которые запускаются автоматически после каждого выполнения задачи. Сбои вызывают повторные попытки автоматического исправления перед дальнейшим продвижением.

```yaml
verification_commands:
  - npm run lint
  - npm run test
verification_auto_fix: true       # auto-retry on failure (default: true)
verification_max_retries: 2       # max retry attempts (default: 2)
```

| Поле | Тип | По умолчанию | Описание |
|-------|------|---------|-------------|
| `verification_commands` | строка[] | `[]` | Команды оболочки, выполняемые после выполнения задачи |
| `verification_auto_fix` | логическое | `true` | Автоматическая повторная попытка при неудачной проверке |
| `verification_max_retries` | номер | `2` | Максимальное количество повторных попыток автоисправления |

### `auto_report` (v2.26)

Автоматическое создание отчетов HTML после завершения этапа:

```yaml
auto_report: true    # default: true
```

Отчеты записываются в `.gsd/reports/` как автономные файлы HTML со встроенными CSS/JS.

### `unique_milestone_ids`

Создайте веху IDs со случайным суффиксом, чтобы избежать конфликтов в рабочих процессах группы:

```yaml
unique_milestone_ids: true
# Produces: M001-eh88as instead of M001
```

### `git`

Конфигурация поведения Git. Все поля необязательны:

```yaml
git:
  auto_push: false            # push commits to remote after committing
  push_branches: false        # push milestone branch to remote
  remote: origin              # git remote name
  snapshots: false            # WIP snapshot commits during long tasks
  pre_merge_check: false      # run checks before worktree merge (true/false/"auto")
  commit_type: feat           # override conventional commit prefix
  main_branch: main           # primary branch name
  merge_strategy: squash      # how worktree branches merge: "squash" or "merge"
  isolation: worktree         # git isolation: "worktree", "branch", or "none"
  commit_docs: true           # commit .gsd/ artifacts to git (set false to keep local)
  manage_gitignore: true      # set false to prevent GSD from modifying .gitignore
  worktree_post_create: .gsd/hooks/post-worktree-create  # script to run after worktree creation
  auto_pr: false              # create a PR on milestone completion (requires push_branches)
  pr_target_branch: develop   # target branch for auto-created PRs (default: main branch)
```

| Поле | Тип | По умолчанию | Описание |
|-------|------|---------|-------------|
| `auto_push` | логическое | `false` | Push выполняет удаленную фиксацию после фиксации |
| `push_branches` | логическое | `false` | Перенести ветку вехи на удаленный |
| `remote` | строка | `"origin"` | Удаленное имя Git |
| `snapshots` | логическое | `false` | Снимок WIP фиксируется во время длительных задач |
| `pre_merge_check` | логическое значение/строка | `false` | Выполнение проверок перед объединением (`true`/`false`/`"auto"`) |
| `commit_type` | строка | (предполагаемый) | Переопределить обычный префикс фиксации (`feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`, `build`, `style`) |
| `main_branch` | строка | `"main"` | Название основного филиала |
| `merge_strategy` | строка | `"squash"` | Как объединяются ветки рабочего дерева: `"squash"` (объединить все коммиты) или `"merge"` (сохранить отдельные коммиты) |
| `isolation` | строка | `"worktree"` | Изоляция в автоматическом режиме: `"worktree"` (отдельный каталог), `"branch"` (работа в корне проекта — полезно для репозиториев с большим количеством подмодулей) или `"none"` (без изоляции — фиксация в текущей ветке, без рабочего дерева или ветки вехи) |
| `commit_docs` | логическое | `true` | Перенесите артефакты планирования `.gsd/` в git. Установите `false`, чтобы сохранить только локальный доступ |
| `manage_gitignore` | логическое | `true` | Когда `false`, GSD вообще не изменяет `.gitignore` — никаких шаблонов базовой линии, никакого самовосстановления. Используйте, если у вас есть собственный `.gitignore` |
| `worktree_post_create` | строка | (нет) | Скрипт, запускаемый после создания рабочего дерева. Получает переменные окружения `SOURCE_DIR` и `WORKTREE_DIR` |
| `auto_pr` | логическое | `false` | Автоматически создавать запрос на включение после завершения этапа. Требуется установка и проверка подлинности `auto_push: true` и `gh` CLI |
| `pr_target_branch` | строка | (основной филиал) | Целевая ветка для автоматически созданного PRs (например, `develop`, `qa`). По умолчанию `main_branch`, если не установлено |

#### `git.worktree_post_create`

Скрипт, запускаемый после создания рабочего дерева (как в автоматическом, так и в ручном режиме `/worktree`). Полезно для копирования файлов `.env`, символических ссылок на каталоги ресурсов или выполнения команд настройки, которые рабочие деревья не наследуют от основного дерева.

```yaml
git:
  worktree_post_create: .gsd/hooks/post-worktree-create
```

Скрипт получает две переменные среды:
- `SOURCE_DIR` — исходный корень проекта.
- `WORKTREE_DIR` — новый путь к рабочему дереву.

Пример скрипта перехвата (`.gsd/hooks/post-worktree-create`):

```bash
#!/bin/bash
# Copy environment files and symlink assets into the new worktree
cp "$SOURCE_DIR/.env" "$WORKTREE_DIR/.env"
cp "$SOURCE_DIR/.env.local" "$WORKTREE_DIR/.env.local" 2>/dev/null || true
ln -sf "$SOURCE_DIR/assets" "$WORKTREE_DIR/assets"
```

Путь может быть абсолютным или относительным к корню проекта. Скрипт выполняется с 30-секундным таймаутом. Сбой не является фатальным — GSD регистрирует предупреждение и продолжает работу.

#### `git.auto_pr`

Автоматически создавать запрос на включение после завершения этапа. Предназначен для команд, использующих Gitflow или рабочие процессы на основе ветвей, где работа должна пройти проверку PR перед слиянием с целевой веткой.

```yaml
git:
  auto_push: true
  auto_pr: true
  pr_target_branch: develop  # or qa, staging, etc.
```

**Требования:**
- `auto_push: true` — перед созданием PR необходимо отправить ветку вехи.
- [`gh` CLI](https://cli.github.com/) установлено и проверено (`gh auth login`)

**Как это работает:**
1. Веха завершена → GSD объединяет рабочее дерево с основной ветвью.
2. Переносит основную ветку на удаленную (если `auto_push: true`)
3. Отправляет ветку вехи на удаленный компьютер.
4. Создает PR из вехи ветки до `pr_target_branch` через `gh pr create`.

Если `pr_target_branch` не установлен, PR нацелен на `main_branch` (или автоматически обнаруженную основную ветвь). Ошибка создания PR не является фатальной — GSD регистрируется и продолжает работу.

### `notifications`

Управляйте тем, какие уведомления GSD отправляет в автоматическом режиме:

```yaml
notifications:
  enabled: true
  on_complete: true           # notify on unit completion
  on_error: true              # notify on errors
  on_budget: true             # notify on budget thresholds
  on_milestone: true          # notify when milestone finishes
  on_attention: true          # notify when manual attention needed
```

### `remote_questions`

Направляйте интерактивные вопросы в Slack или Discord для автономного автоматического режима:

```yaml
remote_questions:
  channel: slack              # or discord
  channel_id: "C1234567890"
  timeout_minutes: 15         # question timeout (1-30 minutes)
  poll_interval_seconds: 10   # poll interval (2-30 seconds)
```

### `post_unit_hooks`

Пользовательские хуки, которые срабатывают после завершения определенных типов юнитов:

```yaml
post_unit_hooks:
  - name: code-review
    after: [execute-task]
    prompt: "Review the code changes for quality and security issues."
    model: claude-opus-4-6          # optional: model override
    max_cycles: 1                   # max fires per trigger (1-10, default: 1)
    artifact: REVIEW.md             # optional: skip if this file exists
    retry_on: NEEDS-REWORK.md       # optional: re-run trigger unit if this file appears
    agent: review-agent             # optional: agent definition to use
    enabled: true                   # optional: disable without removing
```

**Известные типы юнитов для `after`:** `research-milestone`, `plan-milestone`, `research-slice`, `plan-slice`, `execute-task`, `complete-slice`, `replan-slice`, `reassess-roadmap`, `run-uat`

**Быстрая замена:** `{milestoneId}`, `{sliceId}`, `{taskId}` заменяются текущими значениями контекста.

### `pre_dispatch_hooks`

Крюки, которые перехватывают юниты перед отправкой. Доступны три действия:

**Изменить** – добавить/добавить текст в строку запроса модуля:

```yaml
pre_dispatch_hooks:
  - name: add-standards
    before: [execute-task]
    action: modify
    prepend: "Follow our coding standards document."
    append: "Run linting after changes."
```

**Пропустить** — пропустить модуль полностью:

```yaml
pre_dispatch_hooks:
  - name: skip-research
    before: [research-slice]
    action: skip
    skip_if: RESEARCH.md            # optional: only skip if this file exists
```

**Заменить** — полностью заменить подсказку объекта:

```yaml
pre_dispatch_hooks:
  - name: custom-execute
    before: [execute-task]
    action: replace
    prompt: "Execute the task using TDD methodology."
    unit_type: execute-task-tdd     # optional: override unit type label
    model: claude-opus-4-6          # optional: model override
```

Все крючки перед отправкой поддерживают `enabled: true/false` для переключения без снятия.

### `always_use_skills` / `prefer_skills` / `avoid_skills`

Настройки маршрутизации навыков:

```yaml
always_use_skills:
  - debug-like-expert
prefer_skills:
  - frontend-design
avoid_skills: []
```

Навыки могут быть простыми именами (смотрите в `~/.gsd/agent/skills/`) или абсолютными путями.

### `skill_rules`

Ситуационная маршрутизация навыков с понятными для человека триггерами:

```yaml
skill_rules:
  - when: task involves authentication
    use: [clerk]
  - when: frontend styling work
    prefer: [frontend-design]
  - when: working with legacy code
    avoid: [aggressive-refactor]
```

### `custom_instructions`

К каждому сеансу прилагаются надежные инструкции:

```yaml
custom_instructions:
  - "Always use TypeScript strict mode"
  - "Prefer functional patterns over classes"
```

Чтобы получить знания, относящиеся к конкретному проекту (шаблоны, ошибки, извлеченные уроки), используйте вместо этого `.gsd/KNOWLEDGE.md` — оно автоматически вводится в каждое приглашение агента. Добавьте записи с `/gsd knowledge rule|pattern|lesson <description>`.

### `dynamic_routing`

Маршрутизация модели на основе сложности. См. [Маршрутизация динамической модели](./dynamic-model-routing.md).

```yaml
dynamic_routing:
  enabled: true
  tier_models:
    light: claude-haiku-4-5
    standard: claude-sonnet-4-6
    heavy: claude-opus-4-6
  escalate_on_failure: true
  budget_pressure: true
  cross_provider: true
```

### `auto_visualize`

Автоматически отображать визуализатор рабочего процесса после завершения этапа:

```yaml
auto_visualize: true
```

См. [Визуализатор рабочего процесса](./visualizer.md).

### `parallel`

Выполняйте несколько этапов одновременно. По умолчанию отключено.

```yaml
parallel:
  enabled: false            # Master toggle
  max_workers: 2            # Concurrent workers (1-4)
  budget_ceiling: 50.00     # Aggregate cost limit in USD
  merge_strategy: "per-milestone"  # "per-slice" or "per-milestone"
  auto_merge: "confirm"            # "auto", "confirm", or "manual"
```

Полную документацию см. в разделе [Параллельная оркестровка](./parallel-orchestration.md).

## Полный пример

```yaml
---
version: 1

# Model selection
models:
  research: openrouter/deepseek/deepseek-r1
  planning:
    model: claude-opus-4-6
    fallbacks:
      - openrouter/z-ai/glm-5
  execution: claude-sonnet-4-6
  execution_simple: claude-haiku-4-5-20250414
  completion: claude-sonnet-4-6

# Token optimization
token_profile: balanced

# Dynamic model routing
dynamic_routing:
  enabled: true
  escalate_on_failure: true
  budget_pressure: true

# Budget
budget_ceiling: 25.00
budget_enforcement: pause
context_pause_threshold: 80

# Supervision
auto_supervisor:
  soft_timeout_minutes: 15
  hard_timeout_minutes: 25

# Git
git:
  auto_push: true
  merge_strategy: squash
  isolation: worktree         # "worktree", "branch", or "none"
  commit_docs: true

# Skills
skill_discovery: suggest
skill_staleness_days: 60     # Skills unused for N days get deprioritized (0 = disabled)
always_use_skills:
  - debug-like-expert
skill_rules:
  - when: task involves authentication
    use: [clerk]

# Notifications
notifications:
  on_complete: false
  on_milestone: true
  on_attention: true

# Visualizer
auto_visualize: true

# Hooks
post_unit_hooks:
  - name: code-review
    after: [execute-task]
    prompt: "Review {sliceId}/{taskId} for quality and security."
    artifact: REVIEW.md
---
```
