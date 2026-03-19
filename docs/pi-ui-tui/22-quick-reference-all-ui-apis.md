# Краткий справочник — все UI APIs

### Методы диалога ctx.ui (Блокировка)

| Метод | Возврат | Описание |
|--------|---------|-------------|
| `select(title, options)` | `string \| undefined` | Диалог выбора |
| `confirm(title, message, opts?)` | `boolean` | Да/Нет подтверждение |
| `input(label, placeholder?, opts?)` | `string \| undefined` | Однострочный ввод текста |
| `editor(label, prefill?, opts?)` | `string \| undefined` | Многострочный текстовый редактор |

### ctx.ui Постоянные методы (неблокирующие)

| Метод | Описание |
|--------|-------------|
| `notify(message, level)` | Всплывающее уведомление (`"info"`, `"warning"`, `"error"`) |
| `setStatus(id, text?)` | Статус нижнего колонтитула (очистить нажатием `undefined`) |
| `setWidget(id, content?, opts?)` | Виджет выше/ниже редактора |
| `setWorkingMessage(text?)` | Рабочее сообщение во время трансляции |
| `setFooter(factory?)` | Заменить нижний колонтитул (восстановить с помощью `undefined`) |
| `setHeader(factory?)` | Заменить заголовок (восстановить с помощью `undefined`) |
| `setTitle(title)` | Название терминала |
| `setEditorText(text)` | Установить содержимое редактора |
| `getEditorText()` | Получить контент редактора |
| `pasteToEditor(text)` | Вставить в редактор |
| `setToolsExpanded(bool)` | Развернуть/свернуть выходные данные инструмента |
| `getToolsExpanded()` | Получить состояние расширения |
| `setEditorComponent(factory?)` | Заменить редактор (восстановить с помощью `undefined`) |
| `custom(factory, opts?)` | Полный пользовательский компонент/оверлей |
| `setTheme(name \| Theme)` | Сменить тему |
| `getTheme(name)` | Загрузить тему без переключения |
| `getAllThemes()` | Список доступных тем |
| `theme` | Текущий объект темы |

### Интерфейс компонента

| Метод | Требуется | Описание |
|--------|----------|-------------|
| `render(width): string[]` | Да | Рендеринг в линии (каждая ширина ≤) |
| `handleInput(data): void` | Нет | Получить ввод с клавиатуры |
| `invalidate(): void` | Да | Очистить кеши |
| `wantsKeyRelease?: boolean` | Нет | Получайте ключевые события выпуска |

### Ключевой импорт

```typescript
// From @mariozechner/pi-tui
import {
  Text, Box, Container, Spacer, Markdown, Image,
  SelectList, SettingsList, Input, Editor,
  matchesKey, Key,
  visibleWidth, truncateToWidth, wrapTextWithAnsi,
  CURSOR_MARKER,
  type Component, type Focusable, type SelectItem, type SettingItem,
  type EditorTheme, type OverlayAnchor, type OverlayOptions, type OverlayHandle,
} from "@mariozechner/pi-tui";

// From @mariozechner/pi-coding-agent
import {
  DynamicBorder, BorderedLoader, CustomEditor,
  getMarkdownTheme, getSettingsListTheme,
  highlightCode, getLanguageFromPath,
  keyHint, appKeyHint, editorKey, rawKeyHint,
  type ExtensionAPI, type ExtensionContext, type Theme,
} from "@mariozechner/pi-coding-agent";
```

---
