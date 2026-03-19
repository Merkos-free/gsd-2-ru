# Ширина линии — главное правило

**Каждая строка из `render()` MUST NOT превышает параметр `width` по количеству видимых символов.** Это самый распространенный источник ошибок рендеринга.

### Утилиты

```typescript
import { visibleWidth, truncateToWidth, wrapTextWithAnsi } from "@mariozechner/pi-tui";

// Get display width (ignores ANSI escape codes)
visibleWidth("\x1b[32mHello\x1b[0m");  // Returns 5, not 14

// Truncate to fit width (preserves ANSI codes)
truncateToWidth("Very long text here", 10);        // "Very lo..."
truncateToWidth("Very long text here", 10, "");     // "Very long " (no ellipsis)
truncateToWidth("Very long text here", 10, "→");    // "Very long→"

// Word wrap preserving ANSI codes
wrapTextWithAnsi("\x1b[32mThis is a long green text\x1b[0m", 15);
// Returns ["This is a long", "green text"] with ANSI codes preserved per line
```

### Узор

```typescript
render(width: number): string[] {
  const lines: string[] = [];

  // Always truncate any line that could exceed width
  lines.push(truncateToWidth(`  ${prefix}${content}`, width));

  // For dynamic content, calculate available space
  const labelWidth = visibleWidth(label);
  const available = width - labelWidth - 4;  // Leave room for padding
  const truncated = truncateToWidth(value, available);
  lines.push(`  ${label}: ${truncated}`);

  return lines;
}
```

### Почему это важно

Если длина строки превышает `width`, терминал переносит ее, вызывая визуальное искажение — строки перекрываются, курсор неправильно позиционируется, и весь TUI может быть искажен. Платформа TUI **не может исправить это за вас**, поскольку она не знает, как вы хотите обрезать строки.

---
