# Жизненный цикл расширения


```
pi starts
  │
  └─► Extension default function runs
      ├── pi.on("event", handler)    ← Subscribe to events
      ├── pi.registerTool({...})     ← Register tools
      ├── pi.registerCommand(...)    ← Register commands
      └── pi.registerShortcut(...)   ← Register keyboard shortcuts
      
  └─► session_start event fires
      │
      ▼
  User types a prompt ─────────────────────────────────────┐
      │                                                    │
      ├─► Extension commands checked (bypass if match)     │
      ├─► input event (can intercept/transform)            │
      ├─► Skill/template expansion                         │
      ├─► before_agent_start (inject message, modify       │
      │   system prompt)                                   │
      ├─► agent_start                                      │
      │                                                    │
      │   ┌── Turn loop (repeats while LLM calls tools)──┐│
      │   │ turn_start                                    ││
      │   │ context (can modify messages sent to LLM)     ││
      │   │ LLM responds → may call tools:                ││
      │   │   tool_call (can BLOCK)                       ││
      │   │   tool_execution_start/update/end             ││
      │   │   tool_result (can MODIFY)                    ││
      │   │ turn_end                                      ││
      │   └───────────────────────────────────────────────┘│
      │                                                    │
      └─► agent_end                                        │
                                                           │
  User types another prompt ◄──────────────────────────────┘
```

**Важная информация.** Система событий – это основной механизм взаимодействия с числом pi. Каждое значимое событие порождает событие, и большинство событий позволяют вам изменить или заблокировать поведение.

---
