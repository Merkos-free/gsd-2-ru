# Сжатие — как Pi управляет ограничениями контекста

LLMs имеют ограниченное количество контекстных окон. Система уплотнения Pi позволяет разговорам выходить за эти рамки.

### Когда срабатывает сжатие

**Автоматически:** При `contextTokens > contextWindow - reserveTokens` (резерв по умолчанию: 16 384 жетона). Также срабатывает заранее по мере приближения к пределу.

**Вручную:** `/compact [custom instructions]`

### Как это работает

```
Before compaction:

  Messages:  [user][assistant][tool][user][assistant][tool][tool][assistant][tool]
              └──────── summarize these ────────┘ └──── keep these (recent) ────┘
                                                   ↑
                                          keepRecentTokens (default: 20k)

After compaction (new entry appended):

  What the LLM sees:  [system prompt] [summary] [kept messages...]
```

1. Пи идет назад от самого нового сообщения, считая токены, пока не достигнет `keepRecentTokens` (по умолчанию 20 тыс.)
2. Все, что находится до этого момента, суммируется в LLM с использованием структурированного формата.
3. К краткому описанию добавляется `CompactionEntry` и указатель на первое сохраненное сообщение.
4. При перезагрузке LLM видит: системное приглашение → сводка → последние сообщения.

### Разделенные повороты

Иногда один ход (одно приглашение пользователя + все вызовы инструментов) превышает бюджет `keepRecentTokens`. Pi решает эту проблему, вырезая середину хода и генерируя две сводки: одну для истории перед ходом и одну для ранней части разделенного хода.

### Формат сводки

И сжатие, и суммирование ветвей создают структурированные сводки:

```markdown
## Goal
[What the user is trying to accomplish]

## Constraints & Preferences
- [Requirements mentioned by user]

## Progress
### Done
- [x] Completed tasks
### In Progress  
- [ ] Current work
### Blocked
- Issues, if any

## Key Decisions
- **Decision**: Rationale

## Next Steps
1. What should happen next

## Critical Context
- Data needed to continue

<read-files>
path/to/file1.ts
</read-files>

<modified-files>
path/to/changed.ts
</modified-files>
```

### Почему это важно

Сжатие с потерями — в сводке теряется информация. Но полная история остается в файле JSONL. Вы всегда можете использовать `/tree`, чтобы вернуться к состоянию предварительного уплотнения. Компромисс таков: продолжить работу с кратким изложением предыдущего контекста или начать все заново. Расширения могут настраивать сжатие для получения более качественных сводок для вашего конкретного случая использования.

**Настройки:**
```json
{
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  }
}
```

---
