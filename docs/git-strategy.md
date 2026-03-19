# Git-стратегия

GSD использует git для изоляции вех и последовательных коммитов внутри каждой вехи. Вы выбираете **режим изоляции**, который контролирует, где будет происходить работа. Стратегия полностью автоматизирована — вам не нужно управлять филиалами вручную.

## Режимы изоляции

GSD поддерживает три режима изоляции, настроенные с помощью предпочтения `git.isolation`:

| Режим | Рабочий каталог | Филиал | Лучшее для |
|------|-------------------|--------|----------|
| `worktree` (по умолчанию) | `.gsd/worktrees/<MID>/` | `milestone/<MID>` | Большинство проектов — полная изоляция файлов между этапами |
| `branch` | Корень проекта | `milestone/<MID>` | Репозитории с большим количеством подмодулей, где рабочие деревья работают плохо |
| `none` | Корень проекта | Текущая ветка (без вехи) | Рабочие процессы с горячей перезагрузкой, при которых изоляция файлов нарушает работу инструментов разработки |

### `worktree` Режим (по умолчанию)

Каждая веха получает свое собственное рабочее дерево git на уровне `.gsd/worktrees/<MID>/` ветки `milestone/<MID>`. Все выполнение происходит внутри рабочего дерева. По завершении рабочее дерево объединяется с основным как один чистый коммит. Затем рабочее дерево и ветвь очищаются.

Это обеспечивает полную изоляцию файлов — изменения в контрольной точке не могут повлиять на вашу основную рабочую копию.

### `branch` Режим

Работа происходит в корне проекта на ветке `milestone/<MID>`. Рабочее дерево не создается. По завершении ветка объединяется с основной (сквош или обычное слияние, согласно `merge_strategy`).

Используйте это, когда рабочие деревья вызывают проблемы — репозитории с большим количеством подмодулей, репозитории с жестко запрограммированными путями или среды, где символические ссылки рабочего дерева не работают.

### `none` Режим

Работа происходит непосредственно в вашей текущей ветке. Ни рабочего дерева, ни ветки вех. GSD по-прежнему выполняет последовательную фиксацию с обычными сообщениями о фиксации, но изоляции ветвей нет.

Используйте это для рабочих процессов с горячей перезагрузкой, где изоляция файлов нарушает работу инструментов разработки (например, средства наблюдения за файлами, которые видят только корень проекта), или для небольших проектов, где накладные расходы на ветки того не стоят.

## Модель ветвления (режим рабочего дерева)

```
main ─────────────────────────────────────────────────────────
  │                                                     ↑
  └── milestone/M001 (worktree) ────────────────────────┘
       commit: feat(S01/T01): core types
       commit: feat(S01/T02): markdown parser
       commit: feat(S01/T03): file writer
       commit: docs(M001/S01): workflow docs
       ...
       → squash-merged to main as single commit
```

В **режиме ветвления** порядок действий тот же, за исключением того, что работа происходит в корне проекта, а не в отдельном каталоге рабочего дерева.

В режиме **none** коммиты попадают непосредственно в текущую ветку — веха не создается, и этап слияния не требуется.

### Параллельные рабочие деревья

Если включена [параллельная оркестровка](./parallel-orchestration.md), несколько этапов одновременно выполняются в отдельных рабочих деревьях:

```
main ──────────────────────────────────────────────────────────
  │                                      ↑              ↑
  ├── milestone/M002 (worktree) ─────────┘              │
  │    commit: feat(S01/T01): auth types                │
  │    commit: feat(S01/T02): JWT middleware             │
  │    → squash-merged first                            │
  │                                                     │
  └── milestone/M003 (worktree) ────────────────────────┘
       commit: feat(S01/T01): dashboard layout
       commit: feat(S01/T02): chart components
       → squash-merged second
```

Каждое рабочее дерево работает в своей ветке со своей историей коммитов. Слияния происходят последовательно, чтобы избежать конфликтов.

### Ключевые свойства

- **Последовательные фиксации в одной ветке** — нет ветвей для каждого среза, нет конфликтов слияния в пределах вехи.
- **Слияние с основной ** — в режимах рабочего дерева и ветки все коммиты объединяются в одну чистую фиксацию на главной (настраивается с помощью `merge_strategy`)

### Формат фиксации

Коммиты используют обычный формат коммитов с областью действия:

```
feat(S01/T01): core type definitions
feat(S01/T02): markdown parser for plan files
fix(M001/S03): bug fixes and doc corrections
docs(M001/S04): workflow documentation
```

## Управление рабочим деревом

Эти функции применяются только в **режиме рабочего дерева**.

### Автоматический (автоматический режим)

Автоматический режим автоматически создает рабочие деревья и управляет ими:

1. Когда начинается этап, рабочее дерево создается в точке `.gsd/worktrees/<MID>/` ветки `milestone/<MID>`.
2. Артефакты планирования из `.gsd/milestones/` копируются в рабочее дерево.
3. Все выполнение происходит внутри рабочего дерева.
4. По завершении этапа рабочее дерево объединяется с ветвью интеграции.
5. Рабочее дерево и ветка удалены.

### Руководство

Используйте команду `/worktree` (или `/wt`) для ручного управления рабочим деревом:

```
/worktree create
/worktree switch
/worktree merge
/worktree remove
```

## Режимы рабочего процесса

Вместо того, чтобы настраивать каждый параметр git индивидуально, установите `mode`, чтобы получить разумные значения по умолчанию для вашего рабочего процесса:

```yaml
mode: solo    # personal projects — auto-push, squash, simple IDs
mode: team    # shared repos — unique IDs, push branches, pre-merge checks
```

| Настройка | `solo` | `team` |
|---|---|---|
| `git.auto_push` | `true` | `false` |
| `git.push_branches` | `false` | `true` |
| `git.pre_merge_check` | `false` | `true` |
| `git.merge_strategy` | `"squash"` | `"squash"` |
| `git.isolation` | `"worktree"` | `"worktree"` |
| `git.commit_docs` | `true` | `true` |
| `unique_milestone_ids` | `false` | `true` |

Режимы по умолчанию имеют самый низкий приоритет — любые явные предпочтения переопределяют их. Например, сочетание `mode: solo` с `git.auto_push: false` дает вам все возможности, начиная соло, кроме автоматического пуша.

Существующие конфигурации без `mode` работают точно так же, как и раньше — значения по умолчанию не вводятся.

## Настройки Git

Настройте поведение git в настройках:

```yaml
git:
  auto_push: false            # push after commits
  push_branches: false        # push milestone branch
  remote: origin
  snapshots: false            # WIP snapshot commits
  pre_merge_check: false      # pre-merge validation
  commit_type: feat           # override commit type prefix
  main_branch: main           # primary branch name
  commit_docs: true           # commit .gsd/ to git
  isolation: worktree         # "worktree", "branch", or "none"
  auto_pr: false              # create PR on milestone completion
  pr_target_branch: develop   # PR target branch (default: main)
```

### Автоматические запросы на включение

Для команд, использующих Gitflow или рабочие процессы на основе ветвей, GSD может автоматически создавать запрос на включение после завершения контрольной точки:

```yaml
git:
  auto_push: true
  auto_pr: true
  pr_target_branch: develop
```

Это переместит ветку этапа и создаст PR с таргетингом на `develop` (или любую другую указанную вами ветку). Требуется установка `gh` CLI и проверка подлинности. Подробности см. в [git.auto_pr](./configuration.md#gitauto_pr).
```

### `commit_docs: false`

When set to `false`, GSD adds `.gsd/` to `.gitignore` and keeps all planning artifacts local-only. Useful for teams where only some members use GSD, or when company policy requires a clean repository.

## Self-Healing

GSD includes automatic recovery for common git issues:

- **Detached HEAD** — automatically reattaches to the correct branch
- **Stale lock files** — removes `index.lock` files from crashed processes
- **Orphaned worktrees** — detects and offers to clean up abandoned worktrees (worktree mode only)

Run `/gsd doctor` to check git health manually.

## Native Git Operations

Since v2.16, GSD uses libgit2 via native bindings for read-heavy operations in the dispatch hot path. This eliminates ~70 process spawns per dispatch cycle, improving auto-mode throughput.
