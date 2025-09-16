чудово — робимо **NO-CODE UI**: все через форми та майстри, без потреби бачити JSON. Нижче — індустріальне ТЗ із архітектурою, потоками, моделлю даних, валідацією, безпекою, телеметрією, A11y, та критеріями приймання.

---

# ТЗ: MOVA No-Code UI (форми, майстри, прев’ю каноніки)

## 1) Ціль продукту

Дати користувачу можливість:

* обрати шаблон → заповнити форму → отримати **готовий canonical JSON** → (опційно) запустити smoke/dry-run.
  Без коду, без знання англійських ключів.

**Non-goals v1:** колаборація в реальному часі, редагування сирого JSON (лише read-only прев’ю), складні OAuth-мастери.

---

## 2) Ключові сценарії (User Flows)

### F1 — «З нуля за 60 секунд»

1. Користувач відкриває **Галерею шаблонів**.
2. Обирає, наприклад, *“SendGrid Email”*.
3. Відкривається **Майстер** (кроки: Основне → Додаткове → Підсумок).
4. Вводить `from`, `to`, `subject`, `text` (секрет — not required тут).
5. Тисне **Згенерувати** → бачить **canonical preview** + **Валідація ✅**.
6. Тисне **Завантажити .canonical.json** або **Run (dry-run)**.

### F2 — З секретами

1. Обирає *“Stripe Payment Intent”*.
2. У кроці **Секрети**: обирає alias `STRIPE_API_KEY` (якщо нема — додає).
3. Заповнює суму/валюту/опис → **Згенерувати** → **Валідно** → **Dry-run**.

### F3 — SEO JSON-LD

1. Обирає *“LocalBusiness”*.
2. Вводить назву/адресу/години → **Згенерувати** → **Валідно** → **Зберегти event.jsonld**.

---

## 3) Архітектура

### 3.1 Frontend

* **Стек:** React + Tailwind, Headless UI/shadcn для форм, i18next (UI тексти).
* **Сторінки:**

  * `/` — Галерея шаблонів
  * `/template/:id` — Майстер (форми) + Прев’ю
  * `/secrets` — Менеджер секретів (aliases)
  * `/history` — Історія запусків
* **Стан:** Zustand (легкий store) + React Query для API.

### 3.2 Backend (Gateway)

* **Ендпоїнти:**

  * `POST /api/scaffold` — підстановка плейсхолдерів → UA JSON
  * `POST /api/translate` — UA/DE/FR/PL → canonical
  * `POST /api/validate` — AJV 2020-12 проти схем (envelope/route)
  * `POST /api/run` — dry-run/smoke (без зовнішніх сайд-ефектів за замовч.)
  * `GET /api/templates` — список метаданих шаблонів (назва, поля, секції)
  * `GET /api/templates/:id` — модель форми (див. 4.2)
  * `GET /api/secrets` / `POST /api/secrets` — alias-менеджер (локальний vault/ENV)
* **Ізоляція секретів:** значення не повертаємо, лише статус «OK/Absent».

---

## 4) Модель конфігурації шаблону (Form-DSL)

### 4.1 Ціль

Описати форму **одним JSON-файлом**, щоб UI міг:

* відрендерити поля, підказки, валідацію;
* знати, куди підставляти значення в бланк (placeholder mapping);
* позначити, які значення — **секрети** (alias).

### 4.2 Формат `template.form.json` (приклад — SendGrid)

```json
{
  "id": "sendgrid_send_mail",
  "title": "Надіслати лист (SendGrid)",
  "category": "notifications",
  "lang": "uk",
  "source": "templates/blank/ua/sendgrid_send_mail_blank.json",
  "output": "templates/ua/sendgrid_send_mail.json",
  "sections": [
    {
      "title": "Відправник та одержувачі",
      "fields": [
        { "key": "FROM_EMAIL", "label": "Від кого (email)", "type": "email", "required": true, "placeholder": "you@example.com" },
        { "key": "TO_EMAILS", "label": "Кому (email або список через кому)", "type": "textarea", "required": true, "placeholder": "client@example.com" }
      ]
    },
    {
      "title": "Зміст",
      "fields": [
        { "key": "SUBJECT", "label": "Тема", "type": "text", "required": true, "placeholder": "Ваша бронь підтверджена" },
        { "key": "PLAIN_TEXT", "label": "Текст", "type": "textarea", "required": true, "placeholder": "Дякуємо за замовлення!" },
        { "key": "HTML_CONTENT", "label": "HTML (опц.)", "type": "textarea", "required": false, "placeholder": "<b>Дякуємо</b> за замовлення!" }
      ]
    },
    {
      "title": "Безпека",
      "fields": [
        { "key": "SG_KEY_NAME", "label": "Alias секрету API", "type": "secret-alias", "required": true, "default": "SENDGRID_API_KEY" }
      ]
    }
  ],
  "mapping": {
    "FROM_EMAIL": "<FROM_EMAIL>",
    "TO_EMAILS": "<TO_EMAILS>",
    "SUBJECT": "<SUBJECT>",
    "PLAIN_TEXT": "<PLAIN_TEXT>",
    "HTML_CONTENT": "<HTML_CONTENT>",
    "SG_KEY_NAME": "<SG_KEY_NAME>"
  },
  "postprocess": [
    { "type": "emails_to_personalizations", "from": "TO_EMAILS" }
  ],
  "actions": {
    "onComplete": ["translate", "validate", "preview"]
  }
}
```

**Пояснення:**

* `sections[].fields[].type`: `text | textarea | email | number | select | secret-alias | url | tel | array | object`.
* `mapping`: плоска мапа `formKey → placeholder` у бланку.
* `postprocess`: опціональні трансформації значень (напр., перетворити список email у масив об’єктів).
* `actions.onComplete`: автоматизовані кроки після «Створити».

---

## 5) Компоненти UI

### 5.1 Галерея шаблонів

* Фільтр за категоріями (e-commerce, notifications, seo, sheets, webhooks).
* Пошук за назвою/тегами.
* Карточка показує: назва, 3–5 ключових полів, час налаштування («\~1–2 хв»), значок «потребує секретів».

### 5.2 Майстер форми

* Хлібні крихти: «Шаблони → SendGrid → Налаштування».
* Кроки:

  1. Основні поля (required).
  2. Додаткові (optional).
  3. Секрети (alias-підбір).
  4. Підсумок: кнопки **Створити** / **Скинути**.
* Inline-валідація полів, автосейв чернетки локально (IndexedDB).

### 5.3 Прев’ю (read-only)

* Вкладки: **UA-JSON** (заповнений бланк) | **Canonical** | **Validation report**.
* Кнопки: **Скопіювати**, **Завантажити**, **Відкрити у файлах** (опційно).

### 5.4 Secrets Manager

* Таблиця alias → статус (OK / відсутній).
* Форми: додати/оновити alias.
* Кнопка «Перевірити» (НЕ розкриває значення).

### 5.5 Історія запусків

* Список записів: назва шаблону, час, результат (✅/❌), посилання на артефакти (NDJSON/JSONLD).
* «Повторити запуск» з тими ж параметрами.

---

## 6) Валідація та правила

### 6.1 Валідація форм (UI)

* HTML5 + Zod (синхронні помилки): обов’язкові поля, типи (email/url/tel/number).
* Крос-поля: наприклад, у Stripe `amount > 0`.
* Секрети: alias має існувати (статус OK).

### 6.2 Стадії після «Створити»

1. **Scaffold**: підстановка → UA-JSON (без `<PLACEHOLDER>`).
2. **Translate**: UA → canonical.
3. **Validate**: AJV 2020-12 проти `envelope.3.3` / `route.1.0`.
4. **Preview**: показ canonical + короткий звіт.

### 6.3 Помилки (UX)

* Єдина зона повідомлень: sticky bar + список полів з підсвічуванням.
* Пояснення людською мовою + «що виправити» (на базі `$comment` з бланка).

---

## 7) Безпека

* **Секрети ніколи** не вставляємо у JSON-файли; зберігаємо лише alias.
* Логи редагуються (masking): ключі/URL tokenized.
* CORS: фронт говорить лише з нашим gateway.
* CSRF: всі POST — з CSRF-token (або SameSite=strict cookies).
* Rate limit на /run, /validate.

---

## 8) Доступність (A11y)

* Навігація клавіатурою: усі елементи **focusable**; видимий фокус.
* ARIA ролі для табів, алертів, прогрес-барів.
* Контраст ≥ WCAG AA.
* «Skip to content» лінк; Live-region для результатів валідації/рану.

---

## 9) Телеметрія

* Події: `template_open`, `form_submit`, `translate_ok/fail`, `validate_ok/fail`, `run_dry_ok/fail`, `secret_add`.
* Дані без PII; з ідентифікаторами шаблонів та часом.
* Використання — поліпшення бланків (де спотикаються користувачі).

---

## 10) Deployment

* **Frontend**: SPA (Cloudflare Pages/Vercel), версіюємо як `ui@semver`.
* **Backend**: Node/Express (Railway/Fly/Render).
* **Середовища**: dev / staging / prod, окремі набори секретів.
* **CI/CD**:

  * PR → збірка → прев’ю-деплой;
  * main → авто-деплой staging;
  * реліз-тег → prod.

---

## 11) Перформанс

* Lazy-load форм: `template.form.json` підтягуємо по кліку.
* Кешування у браузері (etag) та CDN.
* JSON-операції — у воркері (Web Worker), щоб UI не фрізився.

---

## 12) Модульність і масштабування

* Новий шаблон = додати `template.form.json` + blank.json → UI підхоплює автоматично (категорія/поля/валідація).
* Мови UI: просто додати i18n-файли (окремо від твого лексикону ключів!).

---

## 13) Критерії приймання (MVP)

1. Галерея відображає ≥ 6 шаблонів (ти вже маєш 6).
2. Майстер форми генерує **UA-JSON без плейсхолдерів**.
3. Кнопка «Перекласти» показує canonical у вкладці «Прев’ю».
4. «Валідація» показує ✅/❌ з деталями помилок.
5. Секрети створюються як alias, тести проходять.
6. Dry-run для щонайменше 2 інтеграцій (SendGrid, Slack) — ✅.
7. A11y: повна клавіатурність та видимий фокус.

---

## 14) Backlog наступних ітерацій

* **Генерація форм зі схем** (коли шаблон має власну JSON Schema).
* **Вебхук-емулятор** (надсилати тестові події Shopify/Stripe локально).
* **Експорт/імпорт проєктів** (.zip із форм-даними і canonical).
* **Командний режим** (посилання-чернетки, ролі).
* **Value-лексикон в UI** (відображати `type` людською мовою).

---

## 15) Референси до твого Core (щоб не плодити дубль)

* Валідація використовує твої **канонічні схеми** (`envelope.3.3`, `route.1.0`).
* Трансляція — той самий `translate.mjs` (завернутий у API).
* Scaffold — твій `scaffold.mjs` (параметризовано).

---

## 16) Приклади мінімальних форм-описів (FRAGMENT)

**Slack**

```json
{
  "id": "slack_send_message",
  "title": "Повідомлення у Slack",
  "category": "notifications",
  "source": "templates/blank/ua/slack_send_message_blank.json",
  "sections": [
    { "title": "Основне", "fields": [
      { "key": "CONTENT", "label": "Текст повідомлення", "type": "textarea", "required": true }
    ]},
    { "title": "Безпека", "fields": [
      { "key": "SLACK_WEBHOOK_SECRET_NAME", "label": "Alias Webhook", "type": "secret-alias", "required": true, "default": "SLACK_WEBHOOK_URL" }
    ]}
  ],
  "mapping": { "CONTENT": "<CONTENT>", "SLACK_WEBHOOK_SECRET_NAME": "<SLACK_WEBHOOK_SECRET_NAME>" }
}
```

**Stripe**

```json
{
  "id": "stripe_payment_intent_create",
  "title": "Stripe: створити Payment Intent",
  "category": "payments",
  "source": "templates/blank/ua/stripe_payment_intent_create_blank.json",
  "sections": [
    { "title": "Оплата", "fields": [
      { "key": "AMOUNT_MINOR", "type": "number", "label": "Сума (мінорні одиниці)", "required": true, "min": 1 },
      { "key": "CURRENCY", "type": "text", "label": "Валюта (ISO)", "required": true, "pattern": "^[A-Z]{3}$" },
      { "key": "DESCRIPTION", "type": "text", "label": "Опис", "required": false }
    ]},
    { "title": "Безпека", "fields": [
      { "key": "STRIPE_KEY_NAME", "type": "secret-alias", "label": "Alias API ключа", "required": true, "default": "STRIPE_API_KEY" }
    ]}
  ],
  "mapping": {
    "AMOUNT_MINOR": "<AMOUNT_MINOR>",
    "CURRENCY": "<CURRENCY>",
    "DESCRIPTION": "<DESCRIPTION>",
    "STRIPE_KEY_NAME": "<STRIPE_KEY_NAME>"
  }
}
```

---

