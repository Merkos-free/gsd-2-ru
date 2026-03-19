# Пакеты Pi — Экосистема

Пакеты Pi включают в себя расширения, навыки, подсказки и темы для распространения через npm или git.

### Установка

```bash
pi install npm:@foo/bar@1.0.0       # From npm (pinned)
pi install npm:@foo/bar              # From npm (latest)
pi install git:github.com/user/repo  # From git
pi install ./local/path              # From local path
pi list                              # Show installed
pi update                            # Update non-pinned
pi remove npm:@foo/bar               # Uninstall
pi config                            # Enable/disable resources
```

### Создание

Добавьте клавишу `pi` к `package.json`:

```json
{
  "name": "my-pi-package",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```

Или просто используйте обычные имена каталогов (`extensions/`, `skills/`, `prompts/`, `themes/`), и pi обнаружит их автоматически.

### Поиск пакетов

- [Галерея пакетов](https://shittycodingagent.ai/packages)
- [поиск npm](https://www.npmjs.com/search?q=keywords%3Api-package)
- [Сообщество Discord](https://discord.com/invite/3cU7Bz4UPx)

---
