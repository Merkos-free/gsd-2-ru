# Интерфейс компонента — основа всего

Каждый визуальный элемент в Pi реализует этот интерфейс:

```typescript
interface Component {
  render(width: number): string[];
  handleInput?(data: string): void;
  wantsKeyRelease?: boolean;
  invalidate(): void;
}
```

| Метод | Цель | Необходимый? |
|--------|---------|-----------|
| `render(width)` | Возвращает массив строк (по одной на строку). В каждой строке ≤ `width` видимых символов. | **Да** |
| `handleInput(data)` | Получать ввод с клавиатуры, когда компонент находится в фокусе. | Необязательно |
| `wantsKeyRelease` | Если `true`, получать события выпуска ключа (протокол Kitty). | Необязательно, по умолчанию `false` |
| `invalidate()` | Очистить кэшированное состояние рендеринга. Позвонил по поводу изменения темы. | **Да** |

### Контракт рендеринга

```typescript
render(width: number): string[] {
  // MUST return an array of strings
  // Each string MUST NOT exceed `width` in visible characters
  // ANSI escape codes (colors, styles) don't count toward visible width
  // Styles are reset at end of each line — reapply per line
  // Return [] for zero-height component
}
```

### Контракт о признании недействительным

```typescript
invalidate(): void {
  // Clear ALL cached render output
  // Clear any pre-baked themed strings
  // Call super.invalidate() if extending a built-in component
  // After invalidation, next render() must produce fresh output
}
```

---
