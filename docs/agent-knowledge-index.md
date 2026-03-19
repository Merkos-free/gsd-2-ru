# Индекс знаний агентов

Используйте этот файл в качестве таблицы маршрутизации для рабочих документов и ссылок на исследования.

Правила:

- Чтение только определенных файлов, имеющих отношение к текущей задаче.
- Сначала отдайте предпочтение основному пакету.
- Чтение файлов параллельно, если задача четко соответствует нескольким известным ссылкам.
- Используйте абсолютные пути напрямую с `read`.
- Следуйте условным ссылкам только в том случае, если первичная связка не отвечает на вопрос.

## Пи-архитектура

Используйте, когда:

- понимание того, как работает число Пи, от начала до конца
- отслеживание взаимосвязей подсистем
- понимание сеансов, уплотнения, моделей, инструментов или оперативного потока
- принятие решения о том, как встроить число pi в фирменное приложение, пользовательское приложение CLI, настольное приложение или веб-продукт.

Прочитайте сначала:

- `/Users/lexchristopherson/.gsd/docs/what-is-pi/01-what-pi-is.md`
- `/Users/lexchristopherson/.gsd/docs/what-is-pi/04-the-architecture-how-everything-fits-together.md`
- `/Users/lexchristopherson/.gsd/docs/what-is-pi/05-the-agent-loop-how-pi-thinks.md`

Прочитайте вместе, когда это уместно:

- `/Users/lexchristopherson/.gsd/docs/what-is-pi/06-tools-how-pi-acts-on-the-world.md`
- `/Users/lexchristopherson/.gsd/docs/what-is-pi/07-sessions-memory-that-branches.md`
- `/Users/lexchristopherson/.gsd/docs/what-is-pi/08-compaction-how-pi-manages-context-limits.md`
- `/Users/lexchristopherson/.gsd/docs/what-is-pi/09-the-customization-stack.md`
- `/Users/lexchristopherson/.gsd/docs/what-is-pi/10-providers-models-multi-model-by-default.md`
- `/Users/lexchristopherson/.gsd/docs/what-is-pi/13-context-files-project-instructions.md`

Дальнейшее сопровождение при необходимости:

- `/Users/lexchristopherson/.gsd/docs/what-is-pi/03-the-four-modes-of-operation.md`
- `/Users/lexchristopherson/.gsd/docs/what-is-pi/11-the-interactive-tui.md`
- `/Users/lexchristopherson/.gsd/docs/what-is-pi/12-the-message-queue-talking-while-pi-thinks.md`
- `/Users/lexchristopherson/.gsd/docs/what-is-pi/14-the-sdk-rpc-embedding-pi.md`
- `/Users/lexchristopherson/.gsd/docs/what-is-pi/15-pi-packages-the-ecosystem.md`
- `/Users/lexchristopherson/.gsd/docs/what-is-pi/16-why-pi-matters-what-makes-it-different.md`
- `/Users/lexchristopherson/.gsd/docs/what-is-pi/17-file-reference-all-documentation.md`
- `/Users/lexchristopherson/.gsd/docs/what-is-pi/18-quick-reference-commands-shortcuts.md`
- `/Users/lexchristopherson/.gsd/docs/what-is-pi/19-building-branded-apps-on-top-of-pi.md`

## Контекстная инженерия, перехватчики и поток контекста

Используйте, когда:

- понимание того, как пользовательские подсказки передаются на LLM
- работа с before_agent_start, context,tool_call,tool_result, входными хуками
- внедрение, фильтрация или преобразование контекста LLM
- понимание типов сообщений и того, что на самом деле видит LLM
- координация нескольких расширений
- системы режимов сборки, пресеты или расширения управления контекстом
- отладка того, почему LLM видит или не видит определенную информацию

Прочитайте сначала:

- `/Users/lexchristopherson/.gsd/docs/context-and-hooks/01-the-context-pipeline.md`
- `/Users/lexchristopherson/.gsd/docs/context-and-hooks/02-hook-reference.md`

Прочитайте вместе, когда это уместно:

- `/Users/lexchristopherson/.gsd/docs/context-and-hooks/03-context-injection-patterns.md`
- `/Users/lexchristopherson/.gsd/docs/context-and-hooks/04-message-types-and-llm-visibility.md`
- `/Users/lexchristopherson/.gsd/docs/context-and-hooks/05-inter-extension-communication.md`
- `/Users/lexchristopherson/.gsd/docs/context-and-hooks/06-advanced-patterns-from-source.md`
- `/Users/lexchristopherson/.gsd/docs/context-and-hooks/07-the-system-prompt-anatomy.md`

## Разработка расширений

Используйте, когда:

- создание или изменение расширений
- добавление инструментов, команд, хуков, средств визуализации, состояния или упаковки.

Прочитайте сначала:

- `/Users/lexchristopherson/.gsd/docs/extending-pi/01-what-are-extensions.md`
- `/Users/lexchristopherson/.gsd/docs/extending-pi/02-architecture-mental-model.md`
- `/Users/lexchristopherson/.gsd/docs/extending-pi/03-getting-started.md`

Прочитайте вместе, когда это уместно:

- `/Users/lexchristopherson/.gsd/docs/extending-pi/06-the-extension-lifecycle.md`
- `/Users/lexchristopherson/.gsd/docs/extending-pi/07-events-the-nervous-system.md`
- `/Users/lexchristopherson/.gsd/docs/extending-pi/08-extensioncontext-what-you-can-access.md`
- `/Users/lexchristopherson/.gsd/docs/extending-pi/09-extensionapi-what-you-can-do.md`
- `/Users/lexchristopherson/.gsd/docs/extending-pi/10-custom-tools-giving-the-llm-new-abilities.md`
- `/Users/lexchristopherson/.gsd/docs/extending-pi/11-custom-commands-user-facing-actions.md`
- `/Users/lexchristopherson/.gsd/docs/extending-pi/14-custom-rendering-controlling-what-the-user-sees.md`
- `/Users/lexchristopherson/.gsd/docs/extending-pi/25-slash-command-subcommand-patterns.md` # для косой черты в стиле подкоманды UX через getArgumentCompletions()
- `/Users/lexchristopherson/.gsd/docs/extending-pi/15-system-prompt-modification.md`
- `/Users/lexchristopherson/.gsd/docs/extending-pi/22-key-rules-gotchas.md`

Дальнейшее сопровождение при необходимости:

- `/Users/lexchristopherson/.gsd/docs/extending-pi/04-extension-locations-discovery.md`
- `/Users/lexchristopherson/.gsd/docs/extending-pi/05-extension-structure-styles.md`
- `/Users/lexchristopherson/.gsd/docs/extending-pi/12-custom-ui-visual-components.md`
- `/Users/lexchristopherson/.gsd/docs/extending-pi/13-state-management-persistence.md`
- `/Users/lexchristopherson/.gsd/docs/extending-pi/16-compaction-session-control.md`
- `/Users/lexchristopherson/.gsd/docs/extending-pi/17-model-provider-management.md`
- `/Users/lexchristopherson/.gsd/docs/extending-pi/18-remote-execution-tool-overrides.md`
- `/Users/lexchristopherson/.gsd/docs/extending-pi/19-packaging-distribution.md`
- `/Users/lexchristopherson/.gsd/docs/extending-pi/20-mode-behavior.md`
- `/Users/lexchristopherson/.gsd/docs/extending-pi/21-error-handling.md`
- `/Users/lexchristopherson/.gsd/docs/extending-pi/23-file-reference-documentation.md`
- `/Users/lexchristopherson/.gsd/docs/extending-pi/24-file-reference-example-extensions.md`

## Пи UI и TUI

Используйте, когда:

- создание диалогов, виджетов, наложений, пользовательских редакторов или средств визуализации UI
- работа над макетом или поведением отображения TUI

Прочитайте сначала:

- `/Users/lexchristopherson/.gsd/docs/pi-ui-tui/01-the-ui-architecture.md`
- `/Users/lexchristopherson/.gsd/docs/pi-ui-tui/03-entry-points-how-ui-gets-on-screen.md`
- `/Users/lexchristopherson/.gsd/docs/pi-ui-tui/22-quick-reference-all-ui-apis.md`

Прочитайте вместе, когда это уместно:

- `/Users/lexchristopherson/.gsd/docs/pi-ui-tui/04-built-in-dialog-methods.md`
- `/Users/lexchristopherson/.gsd/docs/pi-ui-tui/05-persistent-ui-elements.md`
- `/Users/lexchristopherson/.gsd/docs/pi-ui-tui/06-ctx-ui-custom-full-custom-components.md`
- `/Users/lexchristopherson/.gsd/docs/pi-ui-tui/07-built-in-components-the-building-blocks.md`
- `/Users/lexchristopherson/.gsd/docs/pi-ui-tui/12-overlays-floating-modals-and-panels.md`
- `/Users/lexchristopherson/.gsd/docs/pi-ui-tui/13-custom-editors-replacing-the-input.md`
- `/Users/lexchristopherson/.gsd/docs/pi-ui-tui/14-tool-rendering-custom-tool-display.md`
- `/Users/lexchristopherson/.gsd/docs/pi-ui-tui/15-message-rendering-custom-message-display.md`
- `/Users/lexchristopherson/.gsd/docs/pi-ui-tui/21-common-mistakes-and-how-to-avoid-them.md`

Дальнейшее сопровождение при необходимости:

- `/Users/lexchristopherson/.gsd/docs/pi-ui-tui/02-the-component-interface-foundation-of-everything.md`
- `/Users/lexchristopherson/.gsd/docs/pi-ui-tui/08-high-level-components-from-pi-coding-agent.md`
- `/Users/lexchristopherson/.gsd/docs/pi-ui-tui/09-keyboard-input-how-to-handle-keys.md`
- `/Users/lexchristopherson/.gsd/docs/pi-ui-tui/10-line-width-the-cardinal-rule.md`
- `/Users/lexchristopherson/.gsd/docs/pi-ui-tui/11-theming-colors-and-styles.md`
- `/Users/lexchristopherson/.gsd/docs/pi-ui-tui/16-performance-caching-and-invalidation.md`
- `/Users/lexchristopherson/.gsd/docs/pi-ui-tui/17-theme-changes-and-invalidation.md`
- `/Users/lexchristopherson/.gsd/docs/pi-ui-tui/18-ime-support-the-focusable-interface.md`
- `/Users/lexchristopherson/.gsd/docs/pi-ui-tui/19-building-a-complete-component-step-by-step.md`
- `/Users/lexchristopherson/.gsd/docs/pi-ui-tui/20-real-world-patterns-from-examples.md`
- `/Users/lexchristopherson/.gsd/docs/pi-ui-tui/23-file-reference-example-extensions-with-ui.md`

## Создание агентов кодирования

Используйте, когда:

- проектирование поведения агента
- улучшение автономности, скорости, обработки контекста или декомпозиции
- решение сложных проблем двусмысленности, безопасности или проверки

Прочитайте сначала:

- `/Users/lexchristopherson/.gsd/docs/building-coding-agents/01-work-decomposition.md`
- `/Users/lexchristopherson/.gsd/docs/building-coding-agents/06-maximizing-agent-autonomy-superpowers.md`
- `/Users/lexchristopherson/.gsd/docs/building-coding-agents/11-god-tier-context-engineering.md`
- `/Users/lexchristopherson/.gsd/docs/building-coding-agents/12-handling-ambiguity-contradiction.md`
- `/Users/lexchristopherson/.gsd/docs/building-coding-agents/26-cross-cutting-themes-where-all-4-models-converge.md`

Прочитайте вместе, когда это уместно:

- `/Users/lexchristopherson/.gsd/docs/building-coding-agents/03-state-machine-context-management.md`
- `/Users/lexchristopherson/.gsd/docs/building-coding-agents/04-optimal-storage-for-project-context.md`
- `/Users/lexchristopherson/.gsd/docs/building-coding-agents/05-parallelization-strategy.md`
- `/Users/lexchristopherson/.gsd/docs/building-coding-agents/07-system-prompt-llm-vs-deterministic-split.md`
- `/Users/lexchristopherson/.gsd/docs/building-coding-agents/08-speed-optimization.md`
- `/Users/lexchristopherson/.gsd/docs/building-coding-agents/10-top-10-pitfalls-to-avoid.md`
- `/Users/lexchristopherson/.gsd/docs/building-coding-agents/17-irreversible-operations-safety-architecture.md`
- `/Users/lexchristopherson/.gsd/docs/building-coding-agents/20-error-taxonomy-routing.md`
- `/Users/lexchristopherson/.gsd/docs/building-coding-agents/24-security-trust-boundaries.md`

Дальнейшее сопровождение при необходимости:

- `/Users/lexchristopherson/.gsd/docs/building-coding-agents/02-what-to-keep-discard-from-human-engineering.md`
- `/Users/lexchristopherson/.gsd/docs/building-coding-agents/09-top-10-tips-for-a-world-class-agent.md`
- `/Users/lexchristopherson/.gsd/docs/building-coding-agents/13-long-running-memory-fidelity.md`
- `/Users/lexchristopherson/.gsd/docs/building-coding-agents/14-multi-agent-semantic-conflict-resolution.md`
- `/Users/lexchristopherson/.gsd/docs/building-coding-agents/15-legacy-code-brownfield-onboarding.md`
- `/Users/lexchristopherson/.gsd/docs/building-coding-agents/16-encoding-taste-aesthetics.md`
- `/Users/lexchristopherson/.gsd/docs/building-coding-agents/18-the-handoff-problem-agent-human-maintainability.md`
- `/Users/lexchristopherson/.gsd/docs/building-coding-agents/19-when-to-scrap-and-start-over.md`
- `/Users/lexchristopherson/.gsd/docs/building-coding-agents/21-cost-quality-tradeoff-model-routing.md`
- `/Users/lexchristopherson/.gsd/docs/building-coding-agents/22-cross-project-learning-reusable-intelligence.md`
- `/Users/lexchristopherson/.gsd/docs/building-coding-agents/23-evolution-across-project-scale.md`
- `/Users/lexchristopherson/.gsd/docs/building-coding-agents/25-designing-for-non-technical-users-vibe-coders.md`

## Документация по продукту Pi

Используйте, когда:

- пользователь спрашивает о самом пи, его SDK, расширениях, темах, навыках, пакетах, TUI, шаблонах подсказок, сочетаниях клавиш или пользовательских поставщиках.

Прочитайте сначала:

- `/Users/lexchristopherson/.nvm/versions/node/v22.20.0/lib/node_modules/@mariozechner/pi-coding-agent/README.md`

Прочитайте вместе, когда это уместно:

- `/Users/lexchristopherson/.nvm/versions/node/v22.20.0/lib/node_modules/@mariozechner/pi-coding-agent/docs/extensions.md`
- `/Users/lexchristopherson/.nvm/versions/node/v22.20.0/lib/node_modules/@mariozechner/pi-coding-agent/docs/themes.md`
- `/Users/lexchristopherson/.nvm/versions/node/v22.20.0/lib/node_modules/@mariozechner/pi-coding-agent/docs/skills.md`
- `/Users/lexchristopherson/.nvm/versions/node/v22.20.0/lib/node_modules/@mariozechner/pi-coding-agent/docs/prompt-templates.md`
- `/Users/lexchristopherson/.nvm/versions/node/v22.20.0/lib/node_modules/@mariozechner/pi-coding-agent/docs/tui.md`
- `/Users/lexchristopherson/.nvm/versions/node/v22.20.0/lib/node_modules/@mariozechner/pi-coding-agent/docs/keybindings.md`
- `/Users/lexchristopherson/.nvm/versions/node/v22.20.0/lib/node_modules/@mariozechner/pi-coding-agent/docs/sdk.md`
- `/Users/lexchristopherson/.nvm/versions/node/v22.20.0/lib/node_modules/@mariozechner/pi-coding-agent/docs/custom-provider.md`
- `/Users/lexchristopherson/.nvm/versions/node/v22.20.0/lib/node_modules/@mariozechner/pi-coding-agent/docs/models.md`
- `/Users/lexchristopherson/.nvm/versions/node/v22.20.0/lib/node_modules/@mariozechner/pi-coding-agent/docs/packages.md`

Дальнейшее сопровождение при необходимости:

- `/Users/lexchristopherson/.nvm/versions/node/v22.20.0/lib/node_modules/@mariozechner/pi-coding-agent/examples`
