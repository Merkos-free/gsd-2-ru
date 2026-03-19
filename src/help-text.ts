const SUBCOMMAND_HELP: Record<string, string> = {
  config: [
    'Usage: gsd config',
    '',
    'Повторно запустить интерактивный мастер настройки для конфигурации:',
    '  - LLM provider (Anthropic, OpenAI, Google, etc.)',
    '  - Провайдера веб-поиска (Brave, Tavily, встроенный)',
    '  - Удалённых вопросов (Discord, Slack, Telegram)',
    '  - API-ключей инструментов (Context7, Jina, Groq)',
    '',
    'Все шаги можно пропустить и позже изменить через /login или /search-provider.',
  ].join('\n'),

  update: [
    'Usage: gsd update',
    '',
    'Обновить GSD до последней версии.',
    '',
    'Эквивалентно: npm install -g gsd-pi@latest',
  ].join('\n'),

  sessions: [
    'Usage: gsd sessions',
    '',
    'Показать все сохранённые сессии для текущей директории и интерактивно',
    'выбрать одну для продолжения. Показывает дату, число сообщений и превью',
    'первого сообщения для каждой сессии.',
    '',
    'Сессии хранятся отдельно для каждой директории, поэтому вы видите только',
    'те, что были начаты из текущей рабочей директории.',
    '',
    'Сравните с --continue (-c), который всегда продолжает самую недавнюю сессию.',
  ].join('\n'),

  worktree: [
    'Usage: gsd worktree <command> [args]',
    '',
    'Управление изолированными git worktree для параллельных потоков работы.',
    '',
    'Команды:',
    '  list                 Показать worktree со статусом (изменённые файлы, коммиты, грязное состояние)',
    '  merge [name]         Выполнить squash-merge worktree в main и очистить',
    '  clean                Удалить все worktree, которые уже слиты или пусты',
    '  remove <name>        Удалить worktree (--force удаляет даже с несмёрженными изменениями)',
    '',
    'Флаг -w создаёт/возобновляет worktree для интерактивных сессий:',
    '  gsd -w               Автоматически назвать новый worktree или возобновить единственный активный',
    '  gsd -w my-feature    Создать или возобновить именованный worktree',
    '',
    'Жизненный цикл:',
    '  1. gsd -w             Создать worktree и запустить сессию внутри него',
    '  2. (работайте как обычно) Все изменения происходят в ветке worktree',
    '  3. Ctrl+C             Выход — незакоммиченная работа закоммитится автоматически',
    '  4. gsd -w             Продолжить с того места, где остановились',
    '  5. gsd worktree merge Когда закончите, выполнить squash-merge в main',
    '',
    'Примеры:',
    '  gsd -w                              Запустить новый worktree с автоименем',
    '  gsd -w auth-refactor                Создать/возобновить worktree "auth-refactor"',
    '  gsd worktree list                   Показать все worktree и их статус',
    '  gsd worktree merge auth-refactor    Слить и очистить',
    '  gsd worktree clean                  Удалить все слитые/пустые worktree',
    '  gsd worktree remove old-branch      Удалить конкретный worktree',
    '  gsd worktree remove old-branch --force  Удалить даже с несмёрженными изменениями',
  ].join('\n'),

  headless: [
    'Usage: gsd headless [flags] [command] [args...]',
    '',
    'Запуск команд /gsd без TUI. Команда по умолчанию: auto',
    '',
    'Флаги:',
    '  --timeout N          Общий таймаут в мс (по умолчанию: 300000)',
    '  --json               Поток событий JSONL в stdout',
    '  --model ID           Переопределить модель',
    '  --supervised           Передавать интерактивные UI-запросы оркестратору через stdout/stdin',
    '  --response-timeout N   Таймаут (мс) ответа оркестратора (по умолчанию: 30000)',
    '  --answers <path>       Заранее передать ответы и секреты (JSON-файл)',
    '  --events <types>       Фильтровать вывод JSONL по конкретным типам событий (через запятую)',
    '',
    'Команды:',
    '  auto                 Непрерывно выполнять все элементы в очереди (по умолчанию)',
    '  next                 Выполнить один элемент',
    '  status               Показать панель прогресса',
    '  new-milestone        Создать milestone из документа спецификации',
    '  query                JSON-снимок: состояние + следующий dispatch + стоимость (без LLM)',
    '',
    'Флаги new-milestone:',
    '  --context <path>     Путь к файлу spec/PRD (используйте \'-\' для stdin)',
    '  --context-text <txt> Текст спецификации inline',
    '  --auto               Запустить auto-mode после создания milestone',
    '  --verbose            Показывать вызовы инструментов в выводе прогресса',
    '',
    'Примеры:',
    '  gsd headless                                    Запустить /gsd auto',
    '  gsd headless next                               Выполнить один элемент',
    '  gsd headless --json status                      Статус в машиночитаемом виде',
    '  gsd headless --timeout 60000                    С таймаутом 1 минута',
    '  gsd headless new-milestone --context spec.md    Создать milestone из файла',
    '  cat spec.md | gsd headless new-milestone --context -   Получить из stdin',
    '  gsd headless new-milestone --context spec.md --auto    Создать и сразу запустить',
    '  gsd headless --supervised auto                     Режим оркестратора с сопровождением',
    '  gsd headless --answers answers.json auto              С заранее переданными ответами',
    '  gsd headless --events agent_end,extension_ui_request auto   Отфильтрованный поток событий',
    '  gsd headless query                              Мгновенный JSON-снимок состояния',
    '',
    'Коды выхода: 0 = завершено, 1 = ошибка/таймаут, 2 = заблокировано',
  ].join('\n'),
}

// Alias: `gsd wt --help` → same as `gsd worktree --help`
SUBCOMMAND_HELP['wt'] = SUBCOMMAND_HELP['worktree']

export function printHelp(version: string): void {
  process.stdout.write(`GSD v${version} — Get Shit Done\n\n`)
  process.stdout.write('Usage: gsd [options] [message...]\n\n')
  process.stdout.write('Параметры:\n')
  process.stdout.write('  --mode <text|json|rpc|mcp> Режим вывода (по умолчанию: interactive)\n')
  process.stdout.write('  --print, -p              Режим однократного вывода\n')
  process.stdout.write('  --continue, -c           Продолжить самую недавнюю сессию\n')
  process.stdout.write('  --worktree, -w [name]    Запустить в изолированном worktree (если имя не указано, будет автоимя)\n')
  process.stdout.write('  --model <id>             Переопределить модель (например, claude-opus-4-6)\n')
  process.stdout.write('  --no-session             Отключить сохранение сессии\n')
  process.stdout.write('  --extension <path>       Загрузить дополнительное расширение\n')
  process.stdout.write('  --tools <a,b,c>          Ограничить доступные инструменты\n')
  process.stdout.write('  --list-models [search]   Показать доступные модели и выйти\n')
  process.stdout.write('  --version, -v            Показать версию и выйти\n')
  process.stdout.write('  --help, -h               Показать эту справку и выйти\n')
  process.stdout.write('\nПодкоманды:\n')
  process.stdout.write('  config                   Повторно запустить мастер настройки\n')
  process.stdout.write('  update                   Обновить GSD до последней версии\n')
  process.stdout.write('  sessions                 Показать и продолжить прошлую сессию\n')
  process.stdout.write('  worktree <cmd>           Управление worktree (list, merge, clean, remove)\n')
  process.stdout.write('  headless [cmd] [args]    Запустить команды /gsd без TUI (по умолчанию: auto)\n')
  process.stdout.write('\nЗапустите gsd <subcommand> --help для справки по конкретной подкоманде.\n')
}

export function printSubcommandHelp(subcommand: string, version: string): boolean {
  const help = SUBCOMMAND_HELP[subcommand]
  if (!help) return false
  process.stdout.write(`GSD v${version} — Get Shit Done\n\n`)
  process.stdout.write(help + '\n')
  return true
}
