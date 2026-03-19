# Производительность — кэширование и аннулирование

### Шаблон кэширования

Всегда кэшируйте вывод `render()` и пересчитывайте только при изменении состояния:

```typescript
class CachedComponent {
  private cachedWidth?: number;
  private cachedLines?: string[];

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    // Expensive computation here
    const lines = this.computeLines(width);

    this.cachedWidth = width;
    this.cachedLines = lines;
    return lines;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}
```

### Цикл обновления

```
State changes → invalidate() → tui.requestRender() → render(width) called
```

1. Что-то меняет состояние вашего компонента (пользовательский ввод, таймер, асинхронный результат)
2. Вызовите `this.invalidate()`, чтобы очистить кэши.
3. Позвоните по номеру `tui.requestRender()`, чтобы запланировать повторный рендеринг.
4. TUI вызывает `render(width)` в следующем кадре.
5. Ваш компонент пересчитывает свои выходные данные (поскольку кеш был очищен).

### Шаблон игрового цикла (обновления в реальном времени)

```typescript
class GameComponent {
  private interval: ReturnType<typeof setInterval> | null = null;
  private version = 0;
  private cachedVersion = -1;

  constructor(private tui: { requestRender: () => void }) {
    this.interval = setInterval(() => {
      this.tick();
      this.version++;
      this.tui.requestRender();
    }, 100);  // 10 FPS
  }

  render(width: number): string[] {
    if (this.cachedVersion === this.version && /* width unchanged */) {
      return this.cachedLines;
    }
    // ... render ...
    this.cachedVersion = this.version;
    return lines;
  }

  dispose(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
```

---
