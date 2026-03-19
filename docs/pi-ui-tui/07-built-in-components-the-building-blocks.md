# Встроенные компоненты — строительные блоки

Импорт из `@mariozechner/pi-tui`:

### Текст

Многострочный текст с автоматическим переносом слов и дополнительным фоном.

```typescript
import { Text } from "@mariozechner/pi-tui";

const text = new Text(
  "Hello World\nSecond line",  // content (supports \n)
  1,                            // paddingX (default: 1)
  1,                            // paddingY (default: 1)
  (s) => bgGray(s)              // optional background function
);

text.setText("Updated content");  // Update text dynamically
```

**Когда использовать:** одно- или многострочные текстовые блоки, стилизованные метки, сообщения об ошибках.

### Коробка

Контейнер с отступом и цветом фона. Добавьте туда детей.

```typescript
import { Box } from "@mariozechner/pi-tui";

const box = new Box(
  1,                // paddingX
  1,                // paddingY
  (s) => bgGray(s)  // background function
);
box.addChild(new Text("Content inside a box", 0, 0));
box.setBgFn((s) => bgBlue(s));  // Change background dynamically
```

**Когда использовать:** Визуальная группировка контента с помощью цветного фона.

### Контейнер

Группирует дочерние компоненты вертикально (сложены). Никакого собственного визуального стиля.

```typescript
import { Container } from "@mariozechner/pi-tui";

const container = new Container();
container.addChild(component1);
container.addChild(component2);
container.removeChild(component1);
container.clear();  // Remove all children
```

**Когда использовать:** Составление сложных макетов из более простых компонентов.

### Проставка

Пустое вертикальное пространство.

```typescript
import { Spacer } from "@mariozechner/pi-tui";

const spacer = new Spacer(2);  // 2 empty lines
```

**Когда использовать:** Визуальное разделение компонентов.

### Уценка

Отображает уценку с полным форматированием и подсветкой синтаксиса.

```typescript
import { Markdown } from "@mariozechner/pi-tui";
import { getMarkdownTheme } from "@mariozechner/pi-coding-agent";

const md = new Markdown(
  "# Title\n\nSome **bold** text\n\n```js\nconst x = 1;\n```",
  1,                    // paddingX
  1,                    // paddingY
  getMarkdownTheme()    // MarkdownTheme (from pi-coding-agent)
);

md.setText("Updated markdown content");
```

**Когда использовать:** Отрисовка документации, справочного текста, форматированного контента.

### Изображение

Отрисовывает изображения в поддерживаемых терминалах (Kitty, iTerm2, Ghostty, WezTerm).

```typescript
import { Image } from "@mariozechner/pi-tui";

const image = new Image(
  base64Data,    // base64-encoded image data
  "image/png",   // MIME type
  theme,         // ImageTheme
  { maxWidthCells: 80, maxHeightCells: 24 }  // Optional size constraints
);
```

**Когда использовать:** Отображение сгенерированных изображений, снимков экрана, диаграмм.

### Список выбора

Интерактивный выбор из списка с поиском, прокруткой и описанием.

```typescript
import { SelectList, type SelectItem } from "@mariozechner/pi-tui";

const items: SelectItem[] = [
  { value: "opt1", label: "Option 1", description: "First option" },
  { value: "opt2", label: "Option 2", description: "Second option" },
  { value: "opt3", label: "Option 3" },  // description is optional
];

const selectList = new SelectList(
  items,
  10,  // maxVisible (scrollable if more items)
  {
    selectedPrefix: (t) => theme.fg("accent", t),
    selectedText: (t) => theme.fg("accent", t),
    description: (t) => theme.fg("muted", t),
    scrollInfo: (t) => theme.fg("dim", t),
    noMatch: (t) => theme.fg("warning", t),
  }
);

selectList.onSelect = (item) => { /* item.value */ };
selectList.onCancel = () => { /* escape pressed */ };
```

**Когда использовать:** пользователи могут выбирать из списка. Управляет клавишами со стрелками, фильтрацией поиска, прокруткой.

###Список настроек

Переключайте настройки с помощью клавиш со стрелками влево/вправо.

```typescript
import { SettingsList, type SettingItem } from "@mariozechner/pi-tui";
import { getSettingsListTheme } from "@mariozechner/pi-coding-agent";

const items: SettingItem[] = [
  { id: "verbose", label: "Verbose mode", currentValue: "off", values: ["on", "off"] },
  { id: "theme", label: "Theme", currentValue: "dark", values: ["dark", "light", "auto"] },
];

const settingsList = new SettingsList(
  items,
  Math.min(items.length + 2, 15),  // maxVisible
  getSettingsListTheme(),
  (id, newValue) => { /* setting changed */ },
  () => { /* close requested (escape) */ },
  { enableSearch: true },  // Optional: fuzzy search by label
);
```

**Когда использовать:** Панели настроек, группы переключения, конфигурация UIs.

### Ввод

Поле ввода текста с курсором.

```typescript
import { Input } from "@mariozechner/pi-tui";

const input = new Input();
input.setText("initial value");
// Route keyboard input via handleInput
```

### Редактор

Многострочный текстовый редактор с возможностью отмены, удаления слов, перемещения курсора.

```typescript
import { Editor, type EditorTheme } from "@mariozechner/pi-tui";

const editorTheme: EditorTheme = {
  borderColor: (s) => theme.fg("accent", s),
  selectList: {
    selectedPrefix: (t) => theme.fg("accent", t),
    selectedText: (t) => theme.fg("accent", t),
    description: (t) => theme.fg("muted", t),
    scrollInfo: (t) => theme.fg("dim", t),
    noMatch: (t) => theme.fg("warning", t),
  },
};

const editor = new Editor(tui, editorTheme);
editor.setText("prefilled");
editor.onSubmit = (value) => { /* enter pressed */ };
```

---
