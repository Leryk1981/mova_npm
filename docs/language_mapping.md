# Таблиця відповідників мов

## Структурні ключі

| Українська | Німецька | Французька | Польська | Англійська (Canonical) | Опис |
|------------|----------|------------|----------|-------------------------|------|
| версія | version | version | wersja | mova_version | Версія формату MOVA |
| контекст | kontext | contexte | kontekst | @context | JSON-LD контекст |
| дії | aktionen | actions | akcje | actions | Масив дій плану |
| версія_маршруту | route_version | version_route | wersja_trasy | route_version | Версія маршруту |
| тригер | trigger | déclencheur | wyzwalacz | trigger | Тригер виконання |
| виклик | aufruf | appel | wywołanie | invoke | Виклик плану |
| план | plan | plan | plan | plan | Посилання на план |
| посилання_на_план | plan_ref | référence_plan | odwołanie_planu | plan_ref | Референс на план |
| опис | beschreibung | description | opis | description | Опис елемента |
| політики | richtlinien | politiques | polityki | policies | Політики виконання |
| таймаут_мс | timeout_ms | timeout_ms | Таймаут у мілісекундах |
| повтор | wiederholung | retry | Налаштування повторів |
| кількість | anzahl | count | Кількість повторів |
| затримка_мс | delay_ms | delay_ms | Затримка у мілісекундах |
| мертва_черга | dlq | dlq | Dead Letter Queue |
| бюджет_мс | budget_ms | budget_ms | Бюджет часу |
| черга | warteschlange | queue | Назва черги |
| розклад | planung | schedule | Розклад виконання |
| подія | ereignis | event | Подія |
| http | http | http | HTTP налаштування |
| шлях | pfad | path | URL шлях |
| метод | methode | method | HTTP метод |
| змінні | variablen | vars | Змінні середовища |
| навантаження | nutzlast | payload | Дані запиту |
| тип_навантаження | nutzlast_typ | payload_media_type | MIME тип payload |
| тип | typ | type | Тип дії |
| при_помилці | bei_fehler | on_error | Обробка помилок |
| для_кожного | für_jedes | for_each | Цикл по елементам |
| елемент_циклу | schleifen_variable | loop_variable | Змінна циклу |
| умова | bedingung | if | Умовний блок |
| при_успіху | bei_erfolg | on_success | Обробка успіху |
| параметри | parameter | parameters | Параметри дії |
| повернути_значення | rückgabe | return | Повернення значення |
| результат_у | ergebnis_in | result_in | Збереження результату |
| перемикач | schalter | switch | Switch оператор |
| випадки | fälle | cases | Cases перемикача |
| за_замовчуванням | standard | default | Default case |
| значення | wert | value | Значення |
| змінна | variable | variable | Змінна |
| повідомлення | nachricht | message | Текстове повідомлення |
| заголовки | header | headers | HTTP заголовки |
| тіло | körper | body | Тіло запиту |
| спробувати | versuchen | try | Try блок |
| зловити | fangen | catch | Catch блок |
| завжди | immer | finally | Finally блок |
| як | als | as | Alias |
| затримка | verzögerung | delay | Затримка |
| мс | ms | ms | Мілісекунди |
| протокол | protokoll | log | Логування |
| встановити_змінну | variable_setzen | set | Встановлення змінної |
| http_запит | http_anfrage | http_request | HTTP запит |
| паралельно | parallel | parallel | Паралельне виконання |
| генерувати_подію | ereignis_generieren | emit_event | Генерація події |
| канал | kanal | channel | Канал події |
| читати_файл | datei_lesen | read_file | Читання файлу |
| кодування | kodierung | encoding | Кодування файлу |
| обробка_речення | verarbeitung | vnl | Обробка природної мови |
| трансформація | transformation | transform | Трансформація даних |
| умовний_блок | bedingter_block | if | Умовний блок (альтернативний) |
| json_патч | json_patch | json_patch | JSON Patch |
| виклик_інструменту | werkzeug_aufruf | tool_call | Виклик інструменту |
| повторити | wiederholen | repeat | Повторення дії |
| викликати | aufrufen | call | Виклик функції |
| видобути_регексом | regex_ausdruck | regex_extract | Регулярний вираз |
| розпарсити_json | json_parsen | parse_json | Парсинг JSON |
| записати_файл | datei_schreiben | file_write | Запис файлу |
| base64 | base64 | base64 | Base64 кодування |
| перевірка | prüfung | assert | Перевірка умови |
| очікування | wartezeit | sleep | Очікування |
| друк | drucken | print | Вивід повідомлення |
| речення | satz | sentence | Речення |
| мова | sprache | lang | Мова |
| розгорнути | erweitern | expand | Розгортання |
| зберегти_як | speichern_als | save_as | Збереження як |
| дерево_розбору | parsebaum | ast | AST дерево |
| назва | name | name | Назва |
| з | von | from | Джерело |
| вибрати | auswählen | pick | Вибір |
| шаблон | vorlage | template | Шаблон |
| коли | wenn | when | Коли |
| тоді | dann | then | Тоді |
| інакше | sonst | else | Інакше |
| дорівнює | gleich | eq | Дорівнює |
| не_дорівнює | ungleich | ne | Не дорівнює |
| більше | größer | gt | Більше |
| більше_або_дорівнює | größer_gleich | gte | Більше або дорівнює |
| менше | kleiner | lt | Менше |
| менше_або_дорівнює | kleiner_gleich | lte | Менше або дорівнює |
| містить | enthält | contains | Містить |
| існує | existiert | exists | Існує |
| ціль | ziel | target | Ціль |
| патч | patch | patch | Патч |
| аргументи | argumente | args | Аргументи |
| кількість_разів | mal | times | Кількість разів |
| вбудований_план | inline_plan | inline_plan | Вбудований план |
| вхідні_дані | eingabe | input | Вхідні дані |
| ключ_ідемпотентності | idempotency_schlüssel | idempotency_key | Ключ ідемпотентності |
| шаблон_регекс | regex_muster | pattern | Шаблон регулярного виразу |
| прапорці | flags | flags | Прапорці регулярного виразу |
| група | gruppe | group | Група захоплення |
| текст | text | text | Текст |
| дані | daten | data | Дані |
| режим | modus | mode | Режим |
| вираз | ausdruck | expr | Вираз |
| рівень | ebene | level | Рівень |

## Типи дій

| Українська | Німецька | Англійська | Опис |
|------------|----------|-------------|------|
| друк | drucken | print | Вивід повідомлення |
| встановити_змінну | variable_setzen | set | Встановлення змінної |
| http_запит | http_anfrage | http_request | HTTP запит |
| паралельно | parallel | parallel | Паралельне виконання |
| генерувати_подію | ereignis_generieren | emit_event | Генерація події |
| читати_файл | datei_lesen | read_file | Читання файлу |
| записати_файл | datei_schreiben | file_write | Запис файлу |
| base64 | base64 | base64 | Base64 кодування |
| перевірка | prüfung | assert | Перевірка умови |
| очікування | wartezeit | sleep | Очікування |
| обробка_речення | verarbeitung | vnl | Обробка природної мови |
| трансформація | transformation | transform | Трансформація даних |
| json_патч | json_patch | json_patch | JSON Patch |
| виклик_інструменту | werkzeug_aufruf | tool_call | Виклик інструменту |
| повторити | wiederholen | repeat | Повторення дії |
| викликати | aufrufen | call | Виклик функції |
| видобути_регексом | regex_ausdruck | regex_extract | Регулярний вираз |
| розпарсити_json | json_parsen | parse_json | Парсинг JSON |

## Приклади використання

### Мінімальний план українською
```json
{
  "версія": "3.3",
  "дії": [
    {
      "тип": "друк",
      "повідомлення": "Привіт MOVA!"
    }
  ]
}
```

### Мінімальний план німецькою
```json
{
  "version": "3.3",
  "aktionen": [
    {
      "typ": "drucken",
      "nachricht": "Hallo MOVA!"
    }
  ]
}
```

### Канонічний план англійською
```json
{
  "mova_version": "3.3.0",
  "actions": [
    {
      "type": "print",
      "message": "Hello MOVA!"
    }
  ]
}
```

## Додавання нової мови

Для додавання нової мови потрібно:

1. Створити `lexicon_<lang>.json` з мапінгом ключів
2. Створити `allowlist_structural_<lang>.json` з дозволеними ключами
3. Додати підтримку в `translate.mjs`
4. Створити бланки в `templates/blank/<lang>/`
5. Оновити цю таблицю

## Нотатки

- **Структурні ключі** завжди транслюються
- **Значення полів** залишаються мовними
- **Типи дій** транслюються окремо
- **Плейсхолдери** замінюються при scaffold
- **Коментарі** ігноруються при трансляції