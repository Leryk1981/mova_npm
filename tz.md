ТЗ: Повна мультимовна реалізація “мовного шару” для MOVA (UA-first, EN-canonical)
0. Мета і результат

Мета: дати розробникам можливість писати плани/маршрути/конверти рідною мовою (uk, de, …), а на виході гарантовано отримувати канонічний англомовний JSON, який проходить валідацію і виконується рантаймом MOVA без змін.

Очікуваний результат:

Мовні пакети (лексикони + allowlist) для щонайменше uk і de.

Універсальний транслятор translate.mjs (input: мовний JSON, output: canonical JSON).

Лінт/перевірки покриття лексиконом, відсутність плейсхолдерів.

“Порожні конверти” (scaffold-шаблони) для ключових сценаріїв (Shopify, JSON-LD, minimal).

CI/CD-конвеєр: translate → validate → runtime smoke.

Документація та ADR-правила змін мови.

1. Обсяг робіт (Scope)
Входить

Мовні пакети uk та de (ключі; значення — опційно).

Трансляція тільки ключів (структурних) у мовних файлах.

Генерація тільки canonical артефактів для валідації/виконання.

Шаблони “порожніх конвертів” з плейсхолдерами.

Перевірки: покриття лексиконом, заборона англійських ключів у мовних файлах, відсутність <PLACEHOLDER>.

Версіонування лексиконів і back-compat політика.

Не входить (Non-goals)

Валідація/виконання безпосередньо мовних файлів (uk/de).

Автоматичний переклад значень (типів дій, enum) — перша фаза фокусується на ключах.

UI-редактор. (Можна додати пізніше, але ТЗ не охоплює.)

2. Терміни та визначення

Мовний файл — JSON із локалізованими ключами (напр. версія, дії).

Лексикон — мапа локалізований_ключ → canonical_key.

Allowlist — перелік локалізованих ключів, які дозволено транслювати (структурні).

Canonical JSON — англомовний JSON, який валідовується схемами MOVA і виконується.

Scaffold — порожній шаблон із плейсхолдерами <…> і $comment-підказками.

3. Архітектура рішення
3.1. Структура репозиторію
lexicon/
  lexicon_uk.json
  lexicon_de.json
  allowlist_structural_uk.json
  allowlist_structural_de.json

templates/
  blank/
    ua/ ...
    de/ ...
  ua/ ...            # користувач заповнює
  de/ ...
  canonical/ ...     # автогенерація (read-only)

schemas/             # канонічні схеми MOVA
scripts/
  translation/translate.mjs
  validation/no_placeholders.mjs
  validation/validate_schemas.mjs
  validation/lint_templates.mjs
  build/extract_keys.mjs
  build/lexicon_coverage.mjs
  scaffold.mjs

runtime/
  run_plan.mjs       # (існуючий рантайм) — працює тільки з canonical
docs/
  specs/
  adr/

3.2. Дані та потоки

Автор → templates/ua/*.json (або templates/de/*.json)

translate.mjs → templates/canonical/*.canonical.json

validate_schemas.mjs → перевіряє canonical

run_plan.mjs → виконує canonical

CI: translate (усі мовні каталоги) → validate (усі canonical) → smoke run

4. Мовні пакети
4.1. Лексикони (ключі)

Формат: lexicon_<lang>.json — словник тільки ключів (без значень).

Вимоги:

Усі структурні ключі схем повинні бути покриті принаймні в одній мові (uk).

Для де—може бути часткове покриття (але CI попереджає).

Заборонено змінювати існуючі відповідники без ADR.

4.2. Allowlist

Формат: allowlist_structural_<lang>.json.

Містить локалізовані назви ключів, які транслюються.

Невідомі локалізовані ключі не транслюються (залишаються як є в payload’і).

4.3. Value-лексикон (пізніше)

Окремий файл (напр. value_lexicon_uk.json) для значень (типів дій).

Застосовується лише в контекстах, де ключ — type, method, strategy тощо (після RFC/ADR).

5. Транслятор
5.1. Вимоги

Підтримка режимів:

один файл → один вихід (in.json → out.canonical.json),

директорія → множина виходів (templates/ua → templates/canonical).

Аргументи:

input (file|dir), --lang=uk|de, --out=<path> (опц.).

Поведінка:

Заборонити англійські структурні ключі у мовних файлах (фейл).

Заміняти тільки ключі з allowlist.

Не чіпати payload-поля, які не входять у allowlist (залишити українськими/німецькими текстами).

Зберігати порядок ключів (наскільки це можливо).

Логи:

Увімкнути “детальний” режим --verbose: показує статистику замін, попереджає про невідомі ключі.

5.2. Вихід

Розширення за замовчуванням: .canonical.json.

Розміщення: поряд (якщо вхід — файл) або у templates/canonical (якщо вхід — директорія).

6. Валідація, лінт, покриття
6.1. Покриття лексиконом

extract_keys.mjs: збирає canonical keys з усіх схем (properties/required).

lexicon_coverage.mjs: перевіряє, що кожен canonical key присутній у значеннях хоча б одного лексикону (uk — must pass; de — warn OK).

Output: build/canonical_keys.json.

6.2. Лінт мовних файлів

lint_templates.mjs:

Заборонити англомовні структурні ключі в templates/ua/**, templates/de/**.

Заборонити content-type/content_type на рівні дій (якщо політика “single source” у конверті).

Попередження щодо “незнайомих” локалізованих ключів.

6.3. Плейсхолдери

no_placeholders.mjs: фейл, якщо у файлі лишилися <PLACEHOLDER>.

6.4. Валідація canonical

validate_schemas.mjs: валідує лише templates/canonical/**.

Мета-схема JSON Schema 2020-12 — обов’язково.

Для envelope 3.3 — перевірка payload_media_type:

якщо application/ld+json → payload.@context обов’язковий.

7. Scaffold (порожні конверти)
7.1. Принципи

Плейсхолдери в кутових дужках <…>.

$comment — короткі підказки поруч із полем.

Мінімум необхідних полів, усе зайве — прибрано.

7.2. Набір бланків (обов’язковий)

Shopify:

shopify_orders_blank.json (orders → JSONL),

shopify_product_create_blank.json,

webhook_shopify_orders_create_route_blank.json.

JSON-LD:

envelope_jsonld_event_blank.json.

Minimal:

envelope_min_blank.json.

7.3. Скрипт підстановки

scaffold.mjs: копіює бланк, підставляє key=value у <KEY>.

8. CI/CD
8.1. Джоби

build:keys → extract_keys.mjs → canonical_keys.json.

check:lexicon → lexicon_coverage.mjs.

lint → lint_templates.mjs + no_placeholders.mjs.

translate:

translate.mjs templates/ua uk,

translate.mjs templates/de de (якщо є файли).

validate → validate_schemas.mjs по templates/canonical/**.

smoke → 1–2 плани (без зовнішніх side-effects, або у dry-run).

8.2. Артефакти

Публікація canonical JSON як build-артефактів/preview у PR.

9. Безпека та секрети

Секрети не потрапляють у репозиторій; план використовує дію secrets.get.

Вебхуки: перевірка HMAC (Shopify).

Логи: при фейлах не друкувати секретні значення.

10. Продуктивність і межі

Транслятор має працювати лінійно від розміру файлів (JSON-streaming не потрібен).

Обмеження глибини рекурсії — достатньо для практичних планів (не менше 100).

Для великих директорій — батч-логування та кеш індексів (не обов’язково у першій версії).

11. Сумісність і версіонування

Семвер для мовних пакетів: зміна відповідника ключа → minor, видалення → major.

ADR для кожного спірного найменування або зміни поведінки.

Back-compat: старі мовні файли повинні перекладатися тим самим лексиконом без помилок або з “м’яким” попередженням.

12. Документація

README.md: швидкий старт “як написати мовний файл → отримати canonical → валідатор → запуск”.

docs/specs/: опис мовного шару, обмеження, приклади.

docs/adr/: рішення щодо суперечливих термінів.

“Словник термінів” (UA/DE → EN canonical) з пошуком.

13. Тестування (Acceptance)

Unit:

Транслятор: кейси різних ключів, вкладені об’єкти, масиви.

Лінт: заборона англомовних ключів.

No-placeholders: виявлення <…>.

E2E:

templates/blank/ua/shopify_orders_blank.json → scaffold → translate → validate → smoke.

templates/blank/ua/envelope_jsonld_event_blank.json → translate → validate (перевірка @context).

de мінімальні приклади → translate → validate.

Негативні:

Вставити англомовний ключ у мовний файл → транслятор падає.

Пропустити ключ у лексиконі → check:lexicon падає.

Залишити <PLACEHOLDER> → no_placeholders падає.

14. Команди (npm scripts, приклад)
{
  "scripts": {
    "build:keys": "node scripts/build/extract_keys.mjs",
    "check:lexicon": "node scripts/build/lexicon_coverage.mjs",

    "lint:ua": "node scripts/validation/lint_templates.mjs templates/ua && node scripts/validation/no_placeholders.mjs templates/ua",
    "lint:de": "node scripts/validation/lint_templates.mjs templates/de && node scripts/validation/no_placeholders.mjs templates/de",

    "translate:ua": "node scripts/translation/translate.mjs templates/ua uk",
    "translate:de": "node scripts/translation/translate.mjs templates/de de",

    "validate:canonical": "node scripts/validation/validate_schemas.mjs templates/canonical",

    "build:all": "npm run build:keys && npm run check:lexicon && npm run lint:ua && npm run translate:ua && npm run validate:canonical",
    "build:all:with-de": "npm run build:keys && npm run check:lexicon && npm run lint:ua && npm run lint:de && npm run translate:ua && npm run translate:de && npm run validate:canonical",

    "scaffold:shopify:orders": "node scripts/scaffold.mjs templates/blank/ua/shopify_orders_blank.json templates/ua/shopify_orders.json",
    "scaffold:jsonld:event": "node scripts/scaffold.mjs templates/blank/ua/envelope_jsonld_event_blank.json templates/ua/event.json"
  }
}

15. План по етапах (milestones)

M1 — Лексикон uk + транслятор + базові перевірки

lexicon_uk, allowlist_uk; translate.mjs; lint + no_placeholders; validate canonical.

Acceptance: мінімальні UA → canonical проходять.

M2 — Бланки (UA) + Shopify/JSON-LD smoke

blank/ua; scaffold; smoke сценарії (без зовнішніх side-effects або з dry-run).

M3 — Лексикон de + приклади (de)

lexicon_de + allowlist_de; blank/de мінімум; translate de → canonical → validate.

M4 — CI/CD повний

Ввімкнені всі джоби, артефакти canonical у PR.

M5 — Документація + ADR

README/спеки/ADR; таблиці відповідників.

16. Критерії приймання

Усі скрипти з розділу 14 виконуються без помилок.

Для uk: 100% покриття canonical-ключів (check:lexicon PASS).

Для de: мінімальні приклади транслюються і проходять canonical-валідацію.

Жоден мовний файл не містить англомовних структурних ключів (lint PASS).

Жодних <PLACEHOLDER> у templates/ua/** перед трансляцією (no_placeholders PASS).

JSON-LD envelope при payload_media_type=application/ld+json містить @context, валідація PASS.

Smoke-сценарії виконуються (print/file_* дії) і лог підтверджується.

17. Ризики та зменшення

Розростання лексиконів → ADR + семвер; інструмент lexicon_coverage контролює пропуски.

Плуганина “ключі vs значення” → перша фаза тільки ключі; для значень — окремий RFC.

Змішані мовні файли → лінтер блокує англійські структурні ключі.

Дублювання типів payload → єдине поле payload_media_type у конверті.

18. Додатки (мінімальні приклади)

DE blank → canonical (скорочено)
templates/blank/de/envelope_min_blank.json:

{ "version": "3.3", "aktionen": [ { "typ": "print", "nachricht": "<IHRE_NACHRICHT>" } ] }


Після translate.mjs templates/de de →
templates/canonical/envelope_min.canonical.json:

{ "mova_version": "3.3.0", "actions": [ { "type": "print", "message": "Hallo MOVA!" } ] }
