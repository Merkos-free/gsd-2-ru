# SDK и RPC — встраивание Пи

Pi — это не просто терминальный инструмент. Он предназначен для встраивания в другие приложения.

### SDK (TypeScript)

Для приложений Node.js/TypeScript импортируйте и используйте pi напрямую:

```typescript
import { AuthStorage, createAgentSession, ModelRegistry, SessionManager } from "@mariozechner/pi-coding-agent";

const authStorage = AuthStorage.create();
const modelRegistry = new ModelRegistry(authStorage);

const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  authStorage,
  modelRegistry,
});

// Subscribe to events
session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

// Send prompts
await session.prompt("What files are in the current directory?");
```

SDK предоставляет вам полный контроль: пользовательские инструменты, пользовательские загрузчики ресурсов, управление сеансами, выбор модели, потоковую передачу событий. См. проект [openclaw/openclaw](https://github.com/openclaw/openclaw) для реальной интеграции SDK.

### RPC Режим (любой язык)

Для приложений non-Node.js создайте pi как подпроцесс и общайтесь через JSON через stdin/stdout:

```bash
pi --mode rpc --provider anthropic
```

Отправьте команды:
```json
{"type": "prompt", "message": "Hello, world!"}
{"type": "steer", "message": "Stop and do this instead"}
{"type": "follow_up", "message": "After you're done, also do this"}
```

Получать события:
```json
{"type": "event", "event": {"type": "message_update", ...}}
{"type": "response", "command": "prompt", "success": true}
```

---
