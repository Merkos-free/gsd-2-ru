# Тематика — цвета и стили.

### Использование цветов темы

Объект `theme` всегда передается через обратные вызовы — никогда не импортируйте его напрямую.

```typescript
// Foreground color
theme.fg("accent", "Highlighted text")     // Apply foreground color
theme.fg("success", "✓ Passed")
theme.fg("error", "✗ Failed")
theme.fg("warning", "⚠ Warning")
theme.fg("muted", "Secondary text")
theme.fg("dim", "Tertiary text")

// Background color
theme.bg("selectedBg", "Selected item")
theme.bg("toolSuccessBg", "Success background")

// Text styles
theme.bold("Bold text")
theme.italic("Italic text")
theme.strikethrough("Struck through")

// Combination
theme.fg("accent", theme.bold("Bold and colored"))
theme.bg("selectedBg", theme.fg("text", " Selected "))
```

### Все цвета переднего плана

| Категория | Цвета |
|----------|--------|
| **Общие** | `text`, `accent`, `muted`, `dim` |
| **Статус** | `success`, `error`, `warning` |
| **Границы** | `border`, `borderAccent`, `borderMuted` |
| **Сообщения** | `userMessageText`, `customMessageText`, `customMessageLabel` |
| **Инструменты** | `toolTitle`, `toolOutput` |
| **Различия** | `toolDiffAdded`, `toolDiffRemoved`, `toolDiffContext` |
| **Уценка** | `mdHeading`, `mdLink`, `mdLinkUrl`, `mdCode`, `mdCodeBlock`, `mdCodeBlockBorder`, `mdQuote`, `mdQuoteBorder`, `mdHr`, `mdListBullet` |
| **Синтаксис** | `syntaxComment`, `syntaxKeyword`, `syntaxFunction`, `syntaxVariable`, `syntaxString`, `syntaxNumber`, `syntaxType`, `syntaxOperator`, `syntaxPunctuation` |
| **Размышление** | `thinkingOff`, `thinkingMinimal`, `thinkingLow`, `thinkingMedium`, `thinkingHigh`, `thinkingXhigh` |
| **Режимы** | `bashMode` |

### Все цвета фона

`selectedBg`, `userMessageBg`, `customMessageBg`, `toolPendingBg`, `toolSuccessBg`, `toolErrorBg`

### Подсветка синтаксиса

```typescript
import { highlightCode, getLanguageFromPath } from "@mariozechner/pi-coding-agent";

// Highlight with explicit language
const highlighted = highlightCode("const x = 1;", "typescript", theme);

// Auto-detect from file path
const lang = getLanguageFromPath("/path/to/file.rs");  // "rust"
const highlighted = highlightCode(code, lang, theme);
```

### Тема уценки

```typescript
import { getMarkdownTheme } from "@mariozechner/pi-coding-agent";
import { Markdown } from "@mariozechner/pi-tui";

const mdTheme = getMarkdownTheme();
const md = new Markdown(content, 1, 1, mdTheme);
```

---
