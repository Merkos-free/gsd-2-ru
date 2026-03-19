# Изменения темы и аннулирование

Когда пользователь переключает темы, TUI вызывает `invalidate()` для всех компонентов. Если ваш компонент предварительно запекает цвета темы, вам необходимо их перестроить.

### ❌ Неправильно — цвета темы не обновляются

```typescript
class BadComponent extends Container {
  constructor(message: string, theme: Theme) {
    super();
    // Pre-baked theme colors — stuck with old theme forever!
    this.addChild(new Text(theme.fg("accent", message), 1, 0));
  }
}
```

### ✅ Правильно — восстановить при недействительности

```typescript
class GoodComponent extends Container {
  private message: string;
  private theme: Theme;

  constructor(message: string, theme: Theme) {
    super();
    this.message = message;
    this.theme = theme;
    this.rebuild();
  }

  private rebuild(): void {
    this.clear();  // Remove all children
    this.addChild(new Text(this.theme.fg("accent", this.message), 1, 0));
  }

  override invalidate(): void {
    super.invalidate();
    this.rebuild();  // Rebuild with current theme
  }
}
```

### Когда вам понадобится этот шаблон

**NEED для перестроения:** предварительно вычисленные строки `theme.fg()`/`theme.bg()`, результаты `highlightCode()`, сложные дочерние деревья со встроенными цветами.

**DONНе нужно перестраивать:** обратные вызовы тем `(text) => theme.fg("accent", text)`, визуализацию без сохранения состояния, которая каждый раз вычисляет новые данные, простые контейнеры без тематического контента.

---
