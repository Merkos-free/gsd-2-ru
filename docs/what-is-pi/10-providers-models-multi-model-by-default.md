# Поставщики и модели — мультимодель по умолчанию

Pi не привязан к одному провайдеру. Он поддерживает более 20 провайдеров «из коробки» и позволяет добавлять больше.

### Методы аутентификации

**ПодпискиOAuth (через `/login`):**
- Антропный Клод Про/Макс
- OpenAI ChatGPT Plus/Pro (Кодекс)
— второй пилот GitHub
- Google Близнецы CLI
- Гугл Антигравитация

**API ключи (через переменные среды):**
- Anthropic, OpenAI, Azure OpenAI, Google Gemini, Google Vertex, Amazon Bedrock
- Mistral, Groq, Cerebras, xAI, OpenRouter, шлюз Vercel AI
- ZAI, OpenCode Zen, OpenCode Go, Hugging Face, Kimi, MiniMax

### Переключение модели

Вы можете переключать модели в любой момент во время разговора:

- `/model` — открыть выбор модели.
- `Ctrl+L` — То же, что `/model`.
- `Ctrl+P` / `Shift+Ctrl+P` — циклическое переключение моделей с областью действия.
- `Shift+Tab` — Циклический уровень мышления

Изменения модели записываются в сеансе как записи `model_change`, поэтому при возобновлении сеанса pi знает, какую модель вы использовали.

### CLI Выбор модели

```bash
pi --model sonnet                          # Fuzzy match
pi --model openai/gpt-4o                   # Provider/model
pi --model sonnet:high                     # With thinking level
pi --models "claude-*,gpt-4o"             # Scope models for Ctrl+P cycling
pi --list-models                           # List all available
pi --list-models gemini                    # Search by name
```

### Пользовательские поставщики

Добавьте провайдеров с помощью `~/.gsd/agent/models.json` (простой) или расширений (расширенный вариант с OAuth, пользовательская потоковая передача):

```json
// ~/.gsd/agent/models.json
{
  "providers": [{
    "name": "my-proxy",
    "baseUrl": "https://proxy.example.com",
    "apiKey": "PROXY_API_KEY",
    "api": "anthropic-messages",
    "models": [{ "id": "claude-sonnet-4", "name": "Sonnet via Proxy", ... }]
  }]
}
```

---
