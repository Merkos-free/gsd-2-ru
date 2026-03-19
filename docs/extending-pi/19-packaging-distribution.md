# Упаковка и распространение


### Создание пакета Pi

Добавьте манифест `pi` в `package.json`:

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

### Установка пакетов

```bash
pi install npm:@foo/bar@1.0.0
pi install git:github.com/user/repo@v1
pi install ./local/path

# Try without installing:
pi -e npm:@foo/bar
```

### Каталоги соглашений (манифест не требуется)

Если манифест `pi` не существует, pi автоматически обнаруживает:
- Файлы `extensions/` → `.ts` и `.js`
- Папки `skills/` → `SKILL.md`
- Файлы `prompts/` → `.md`
- файлы `themes/` → `.json`

### Метаданные галереи

```json
{
  "pi": {
    "video": "https://example.com/demo.mp4",
    "image": "https://example.com/screenshot.png"
  }
}
```

### Зависимости

- Перечислите `@mariozechner/pi-ai`, `@mariozechner/pi-coding-agent`, `@mariozechner/pi-tui`, `@sinclair/typebox` в `peerDependencies` с `"*"` — они объединены по пи.
- Другие отделы npm идут в `dependencies`. Pi запускает `npm install` при установке пакета.

---
