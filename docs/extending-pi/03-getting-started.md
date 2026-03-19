# Начало работы


### Минимальное расширение

Создайте `~/.gsd/agent/extensions/my-extension.ts`:

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Extension loaded!", "info");
  });
}
```

### Тестирование

```bash
# Quick test (doesn't need to be in extensions dir)
pi -e ./my-extension.ts

# Or just place it in the extensions dir and start pi
pi
```

### Горячая перезагрузка

Расширения в автоматически обнаруженных местоположениях (`~/.gsd/agent/extensions/` или `.gsd/extensions/`) можно перезагрузить в горячем режиме:

```
/reload
```

---
