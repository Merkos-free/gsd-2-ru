# Краткое руководство — команды и сочетания клавиш

### Команды

| Команда | Описание |
|---------|-------------|
| `/login`, `/logout` | OAuth аутентификация |
| `/model` | Модели переключателей |
| `/scoped-models` | Настроить зацикливание модели Ctrl+P |
| `/settings` | Уровень мышления, тема, способ доставки, транспорт |
| `/resume` | Просмотр предыдущих сессий |
| `/new` | Новая сессия |
| `/name <name>` | Имя текущего сеанса |
| `/session` | Информация о сеансе (путь, токены, стоимость) |
| `/tree` | Навигация по дереву сеансов |
| `/fork` | Переход на новую сессию |
| `/compact [instructions]` | Ручное уплотнение |
| `/copy` | Скопировать последний ответ в буфер обмена |
| `/export [file]` | Экспортировать в HTML |
| `/share` | Загрузить как личное GitHub суть |
| `/reload` | Перезагрузить расширения, навыки, подсказки, файлы контекста |
| `/hotkeys` | Показать все сочетания клавиш |
| `/changelog` | История версий |
| `/quit`, `/exit` | Выход пи |

### Сочетания клавиш

| Ключ | Действие |
|-----|--------|
| Ctrl+С | Очистить редактор/выйти (дважды) |
| Побег | Отмена/прерывание/открытие `/tree` (дважды) |
| Ctrl+Л | Выбор модели |
| Ctrl+P / Shift+Ctrl+P | Циклические модели |
| Shift+Tab | Цикл уровня мышления |
| Ctrl+О | Переключить вывод инструмента: развернуть/свернуть |
| Ctrl+Т | Переключить блок мышления развернуть/свернуть |
| Ctrl+G | Открыть внешний редактор |
| Ctrl+V | Вставить (включая изображения) |
| Ввод (во время трансляции) | Сообщение управления очередью |
| Alt+Enter (во время трансляции) | Сообщение о последующем сообщении |
| Alt+Вверх | Получить сообщения из очереди |

### CLI

```bash
pi                                    # Interactive mode
pi "prompt"                           # Interactive with initial prompt
pi -p "prompt"                        # Print mode (non-interactive)
pi -c                                 # Continue last session
pi -r                                 # Resume (browse sessions)
pi --model provider/model:thinking    # Specify model
pi --tools read,bash                  # Specify tools
pi -e ./extension.ts                  # Load extension
pi --mode rpc                         # RPC mode
pi --mode json                        # JSON mode
pi @file.ts "Review this"            # Include file in prompt
pi install npm:package               # Install package
pi list                               # List packages
```

---

*Этот документ был создан на основе документации Pi. Исходные файлы находятся по адресу:*
```
/Users/lexchristopherson/.nvm/versions/node/v22.20.0/lib/node_modules/@mariozechner/pi-coding-agent/
```

*Сопутствующий документ: **Pi-Extensions-Complete-Guide.md** (на рабочем столе)*
