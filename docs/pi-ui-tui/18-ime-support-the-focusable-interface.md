Поддержка # IME — фокусируемый интерфейс

Для компонентов, которые отображают текстовый курсор и которым требуется поддержка IME (редактора метода ввода) для языков CJK:

```typescript
import { CURSOR_MARKER, type Component, type Focusable } from "@mariozechner/pi-tui";

class MyInput implements Component, Focusable {
  focused: boolean = false;  // Set by TUI when focus changes

  render(width: number): string[] {
    const marker = this.focused ? CURSOR_MARKER : "";
    return [`> ${beforeCursor}${marker}\x1b[7m${atCursor}\x1b[27m${afterCursor}`];
  }
}
```

### Контейнер со встроенным вводом

Если ваш контейнер содержит дочерний элемент `Input` или `Editor`, распространите фокус:

```typescript
class SearchDialog extends Container implements Focusable {
  private searchInput: Input;
  private _focused = false;

  get focused(): boolean { return this._focused; }
  set focused(value: boolean) {
    this._focused = value;
    this.searchInput.focused = value;  // Propagate!
  }

  constructor() {
    super();
    this.searchInput = new Input();
    this.addChild(this.searchInput);
  }
}
```

Без этого окна кандидатов IME (китайский, японский, корейский ввод) будут отображаться в неправильном положении.

---
