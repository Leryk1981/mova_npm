# No-Code Automation Platform MOVA

## Огляд

MOVA використовує FORM-DSL для no-code розробки. Форми → canonical → рантайм.
Переклади та ручні UA/DE JSON більше не потрібні.

## Швидкий старт

### 1. Створи форму
```json
// templates/forms/my_form/template.form.json
{
  "id": "my_form",
  "i18n": {
    "title": { "uk": "Моя форма" },
    "sections": { "main": { "uk": "Основне" } },
    "fields": { "MESSAGE": { "uk": "Повідомлення" } }
  },
  "sections": [
    {
      "key": "main",
      "fields": [
        {
          "key": "MESSAGE",
          "type": "text",
          "required": true,
          "sample": "Привіт!"
        }
      ]
    }
  ],
  "baseCanonical": {
    "mova_version": "3.3.0",
    "actions": [
      { "type": "print", "message": "" }
    ]
  },
  "bind": [
    { "from": "MESSAGE", "to": "/actions/0/message", "severity": "error" }
  ]
}
```

### 2. Додай smoke values
```json
// templates/forms/my_form/smoke.values.json
{ "MESSAGE": "Привіт!" }
```

### 3. Запусти dev-прохід
```bash
npm run build:all
```
- `forms:lint` – JSON Schema + bind
- `forms:build:dev` – canonical з автозаповненням sample
- `validate:canonical` – AJV проти envelope/route схем
- `smoke` – dry-run канонічних шаблонів

### 4. Перевір перед релізом
```bash
npm run release:check
```
Prod-режим builder’а блокує відсутні `severity=error` значення і забороняє WARN.

## Структура каталогу
```
mova/
├── templates/
│   ├── forms/<id>/template.form.json
│   ├── forms/<id>/smoke.values.json
│   └── canonical/<id>.canonical.json (output)
├── scripts/
│   ├── forms/       # build_canonical, lint, validate
│   ├── validation/  # AJV перевірки
│   └── run/         # smoke/runtime
├── schemas/         # JSON Schemas
└── docs/            # документація
```

## Скрипти
```bash
npm run forms:lint          # AJV + lint_bindings (--mode=dev)
npm run forms:build:dev     # builder з default/sample та логами покриття
npm run forms:build:prod    # builder у strict режимі
npm run validate:canonical  # AJV перевірка canonical
npm run smoke               # smoke.mjs templates/canonical
npm run build:all           # dev-прохід (lint → build → validate → smoke)
npm run release:check       # prod-прохід (lint → build prod → validate → smoke)
```

## Інтеграційні шаблони
- **SendGrid Email** – `templates/forms/sendgrid_send_mail`
- **Slack Message** – `templates/forms/slack_send_message`
- **Telegram Message** – `templates/forms/telegram_send_message`
- **Discord Message** – `templates/forms/discord_send_message`
- **Stripe Payment Intent** – `templates/forms/stripe_payment_intent_create`
- **Shopify Orders** – `templates/forms/shopify_orders`
- **Google Sheets Append** – `templates/forms/google_sheets_append`
- **WooCommerce Orders** – `templates/forms/woocommerce_orders_list`
- **JSON-LD LocalBusiness** – `templates/forms/jsonld_localbusiness`

## Безпека
- Використовуйте `secret-alias` поля. Builder та UI ніколи не вимагають plaintext секретів.
- Трансформ `bearerFromAlias` повертає `{ "$secret": "ALIAS", "as": "bearer|raw" }`.
- Рантайм підставляє значення з ENV та не логує їх.

## Процес додавання нової форми
1. Скопіюй шаблон у `templates/forms/<id>/template.form.json`.
2. Заповни `sample`/`default`, вистави `severity` у bind.
3. Створи `smoke.values.json` з мінімальними значеннями.
4. Запусти `npm run build:all` та виправ WARN/помилки.
5. Перевір canonical + smoke (логи з builder’а, AJV, рантайм).
6. Перед merge – `npm run release:check` (0 WARN, 0 missing).

## Валідація та тестування
- `forms:lint` – JSON Schema + перевірка, що `bind.from` існує, `bind.to` валідний.
- `forms:build:*` – логує кількість bind/transform, покриття JSON Pointer, заповнені `default`/`sample`.
- `smoke` – використовує згенеровані canonical та `smoke.values.json`.

## Розширення
- Новий трансформ → онови `scripts/forms/build_canonical.mjs` + docs.
- Новий тип поля → онови `schemas/form_spec.schema.json` + UI (`public/app.js`).
- Новий інтеграційний шаблон → форма + smoke values + тест в `smoke.mjs`.
