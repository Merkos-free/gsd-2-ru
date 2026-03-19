# Шаблоны подкоманд команды Slash

В Pi нет отдельной встроенной концепции «вложенных косых команд», таких как `/wt new` или `/foo delete`.

Вместо этого эта UX создается путем регистрации одной косой черты и использования **дополнения аргументов**, чтобы первый аргумент вел себя как подкоманда.

Это шаблон, используемый встроенным расширением рабочего дерева:
- `/wt`
- `/wt new`
- `/wt ls`
- `/wt switch my-branch`

Ключ API:
- `pi.registerCommand(name, options)`
- `getArgumentCompletions(prefix)`
- `handler(args, ctx)`

## Ментальная модель

Отнеситесь к команде как:

- одна косая черта верхнего уровня
- один или несколько позиционных аргументов
- первый позиционный аргумент, действующий как подкоманда
- необязательные последующие аргументы завершаются динамически на основе первого

Итак, это:

```text
/wt
  new
  ls
  switch
  merge
  rm
  status
```

действительно просто:

- команда: `wt`
- первый аргумент: один из `new | ls | switch | merge | rm | status`

## Основной шаблон

```typescript
pi.registerCommand("foo", {
  description: "Manage foo items: /foo new|list|delete [name]",

  getArgumentCompletions: (prefix: string) => {
    const subcommands = ["new", "list", "delete"];
    const parts = prefix.trim().split(/\s+/);

    // Complete the first argument: /foo <subcommand>
    if (parts.length <= 1) {
      return subcommands
        .filter((cmd) => cmd.startsWith(parts[0] ?? ""))
        .map((cmd) => ({ value: cmd, label: cmd }));
    }

    // Complete the second argument: /foo delete <name>
    if (parts[0] === "delete") {
      const items = ["alpha", "beta", "gamma"];
      const namePrefix = parts[1] ?? "";
      return items
        .filter((name) => name.startsWith(namePrefix))
        .map((name) => ({ value: `delete ${name}`, label: name }));
    }

    return [];
  },

  handler: async (args, ctx) => {
    const parts = args.trim().split(/\s+/);
    const sub = parts[0];
    const name = parts[1];

    await ctx.waitForIdle();

    if (sub === "new") {
      ctx.ui.notify("Create a new foo item", "info");
      return;
    }

    if (sub === "list") {
      ctx.ui.notify("List foo items", "info");
      return;
    }

    if (sub === "delete") {
      if (!name) {
        ctx.ui.notify("Usage: /foo delete <name>", "error");
        return;
      }
      ctx.ui.notify(`Deleting ${name}`, "info");
      return;
    }

    ctx.ui.notify("Usage: /foo <new|list|delete> [name]", "info");
  },
});
```

## Как ведет себя `getArgumentCompletions()`

`getArgumentCompletions(prefix)` получает все, что находится после имени команды с косой чертой.

Примеры для `/foo`:

- ввод `/foo ` дает `prefix === ""`
- ввод `/foo de` дает `prefix === "de"`
- ввод `/foo delete a` дает `prefix === "delete a"`

Это означает, что вы можете разобрать префикс на слова и решить, какие предложения показывать дальше.

Общая структура:

1. Если пользователь указан в качестве первого аргумента, отобразите доступные подкоманды.
2. Если первый аргумент выбирает ветвь типа `delete`, покажите завершение для следующего аргумента.
3. В противном случае верните `[]`.

## Важная деталь: обработка пустого префикса

Практическая ошибка заключается в том, что:

```typescript
"".trim().split(/\s+/)
```

производит `['']`, а не `[]`.

Вот почему общая схема такова:

```typescript
const parts = prefix.trim().split(/\s+/);
if (parts.length <= 1) {
  // complete first argument
}
```

Это обрабатывает оба:
- полностью пустой ввод после команды
- частично типизированные первые аргументы

## Динамическое завершение второго аргумента

Этот шаблон становится эффективным, когда последующие аргументы зависят от подкоманды.

Пример:

```typescript
getArgumentCompletions: (prefix) => {
  const parts = prefix.trim().split(/\s+/);
  const sub = parts[0];

  if (parts.length <= 1) {
    return ["new", "list", "delete"].map((s) => ({ value: s, label: s }));
  }

  if (sub === "delete") {
    const items = getCurrentItemsSomehow();
    const namePrefix = parts[1] ?? "";
    return items
      .filter((item) => item.startsWith(namePrefix))
      .map((item) => ({ value: `delete ${item}`, label: item }));
  }

  return [];
}
```

Таким образом, `/wt switch`, `/wt merge` и `/wt rm` могут предлагать текущие имена рабочего дерева.

## Реальный пример: `/wt`

Расширение рабочего дерева использует именно эту структуру:

- `/Users/lexchristopherson/.gsd/agent/extensions/worktree/index.ts`

Он определяет:

```typescript
const subcommands = ["new", "ls", "switch", "merge", "rm", "status"];
```

Тогда:

- когда первый аргумент все еще вводится, он предлагает эти подкоманды
- если первый аргумент – `switch`, `merge` или `rm`, предлагается сопоставить имена рабочих деревьев для второго аргумента.

Вот почему набираем:

```text
/wt 
```

показывает:

```text
new
ls
switch
merge
rm
status
```

и набрав:

```text
/wt switch 
```

показывает доступные имена рабочих деревьев.

## Разбор в обработчике

Ваша логика завершения и логика вашего обработчика должны согласовываться по форме команды.

Общая структура:

```typescript
handler: async (args, ctx) => {
  const parts = args.trim().split(/\s+/);
  const sub = parts[0];
  const rest = parts.slice(1);

  switch (sub) {
    case "new":
      // handle /foo new
      return;
    case "list":
      // handle /foo list
      return;
    case "delete":
      // handle /foo delete <name>
      return;
    default:
      ctx.ui.notify("Usage: /foo <new|list|delete>", "info");
      return;
  }
}
```

Сохраняйте синтаксический анализ простым и зеркально отображайте те же ветки, которые рекламируют ваши завершения.

## Когда использовать этот шаблон

Используйте одну команду с завершением в стиле подкоманды, когда:

- действия принадлежат одному четкому домену
- вам нужна возможность обнаружения из одной точки входа
- подкоманды ощущаются как одно семейство операций
- последующие аргументы зависят от предыдущего выбора

Примеры:

- `/wt new|switch|merge|rm|status`
- `/preset save|load|delete`
- `/workflow start|list|abort`
- `/foo new|list|delete`

## Когда лучше использовать отдельные команды

Отдавайте предпочтение отдельным командам, когда:

- действия концептуально не связаны между собой
- каждая команда нуждается в своем собственном четком описании и идентичности
- автозаполнение станет слишком глубоким или перегруженным
- объединенную команду станет трудно запомнить или документировать

Хорошие кандидаты в отдельные команды:

- `/deploy`
- `/rollback`
- `/handoff`

вместо того, чтобы объединять их всех в одну команду.

## UX Рекомендации

Несколько практических правил сделают этот шаблон приятным:

- Делайте подкоманды верхнего уровня короткими и понятными.
- Используйте имена, которые естественным образом читаются после косой черты.
- Следите за тем, чтобы ветки были неглубокими; одного или двух уровней обычно достаточно.
— Возвращать пустой массив, если завершение не имеет смысла.
- Сделайте так, чтобы текст резервного использования соответствовал вашей структуре завершения.
- Если подкоманде требуются необходимые данные, проверьте их еще раз в обработчике.

## Рекомендуемая структура

Сплошная команда с подкомандами обычно имеет:

- `description` показывает грамматику верхнего уровня.
- `getArgumentCompletions()` для предложений первого и второго аргумента.
- `handler()`, который разветвляется по первому аргументу
- сообщение об использовании резервного варианта для недопустимого ввода

Пример описания:

```typescript
description: "Manage foo items: /foo new|list|delete [name]"
```

## Сопутствующие документы

Прочтите их рядом с этим шаблоном:

- `/Users/lexchristopherson/.gsd/docs/extending-pi/11-custom-commands-user-facing-actions.md`
- `/Users/lexchristopherson/.gsd/docs/extending-pi/09-extensionapi-what-you-can-do.md`
- `/Users/lexchristopherson/.gsd/agent/extensions/worktree/index.ts`

## Резюме

Если вы хотите, чтобы `/foo` вела себя так, как будто у нее есть вложенные подкоманды, сделайте следующее:

1. зарегистрировать одну косую черту
2. рассматривать первый аргумент как подкоманду
3. реализовать `getArgumentCompletions(prefix)`
4. при необходимости динамически дополнять последующие аргументы
5. переход в обработчике на основе разобранного первого аргумента

Это механизм, лежащий в основе опыта `/wt`.
