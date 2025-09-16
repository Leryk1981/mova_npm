# FORM-DSL Специфікація v1.1

## Огляд

FORM-DSL описує інтерактивні форми у MOVA. Кожна форма (`template.form.json`)
містить метадані, поля, базовий canonical та правила прив’язки.

## Структура FORM-спеки

```json
{
  "id": "template_id",
  "i18n": {
    "title": { "uk": "Назва форми" },
    "sections": { "section_key": { "uk": "Назва" } },
    "fields": { "FIELD_KEY": { "uk": "Мітка" } }
  },
  "sections": [
    {
      "key": "section_key",
      "fields": [
        {
          "key": "FIELD_KEY",
          "type": "text|textarea|email|number|url|tel|secret-alias|select|checkbox|array|object",
          "required": true|false,
          "default": "значення",
          "sample": "значення для автозаповнення",
          "validators": { "pattern": "regex", "min": 0, "max": 10 }
        }
      ]
    }
  ],
  "baseCanonical": {
    "mova_version": "3.3",
    "actions": [...]
  },
  "bind": [
    {
      "from": "FIELD_KEY",
      "to": "/json/pointer/path",
      "transform": "transform_name",
      "transformArgs": { "as": "raw" },
      "severity": "error|warn"
    }
  ]
}
```

### Поля
- `default` – значення за замовчуванням (потрапляє до builder’а, якщо користувач нічого не ввів).
- `sample` – приклад, який використовує UI («Заповнити прикладом») та builder `--fill-sample`.
- `validators` – мінімальні перевірки на рівні UI/builder (`pattern`, `min`, `max`).

### Bind
- `severity` визначає реакцію builder’а у prod-режимі: `error` зупиняє збірку, `warn` лише попереджає.
- `transformArgs` передаються у трансформ.

## Типи полів
`text`, `textarea`, `email`, `number`, `url`, `tel`, `secret-alias`, `select`, `checkbox`, `array`, `object`.

## JSON Pointer у bind
Використовується RFC 6901. Приклади: `/actions/0/type`, `/payload/name`.

## Трансформи

### emailsToArray(str)
Перетворює рядок email-адрес через кому у масив `{ email }`.

### bearerFromAlias(alias, args?)
Повертає структуру секрету.

```json
{
  "$secret": "SENDGRID_API_KEY",
  "as": "bearer"    // або "raw"
}
```

### int(str)
Парсить ціле число (повертає `undefined`, якщо значення порожнє).

### float(str)
Парсить число з плаваючою комою.

### json(str)
Парсить JSON-рядок (порожній рядок → `{}`).

## Секрети в canonical
Будь-яке поле може містити об’єкт `{ "$secret": "ALIAS", "as": "bearer|raw" }`.
Рантайм підставляє реальне значення перед виконанням дій, не логуючи його.

## Режими builder’а
- `--mode=dev` – заповнює `default`/`sample`, відсутні обов’язкові поля → WARN.
- `--mode=prod` – відсутні значення з `severity=error` зупиняють збірку та повертають код ≠ 0.
- `--fill-sample` – примусово підставляє `sample` у всі поля без значень (з лейблом у логах).
- Builder логіює `bindsApplied`, `transformsApplied`, покриття JSON Pointer.

## Smoke values
Кожна форма має `templates/forms/<id>/smoke.values.json` – мінімальний набір `formValues` для збірки.
Використовується CLI (`forms:build:dev`) та smoke-тести.

## JSON Schema
Файл `schemas/form_spec.schema.json` валідовує:
- типи полів;
- наявність `sample`/`default` (будь-якого типу);
- валідність JSON Pointer;
- допустимі значення `severity`.

## Best Practices
1. Додавайте `sample` для всіх required-полів – це дозволяє builder’у і UI заповнювати план автоматично.
2. Встановлюйте `severity=error` для обов’язкових прив’язок, `warn` – для опційних.
3. Використовуйте `validators` для базових перевірок (наприклад, regex для email).
4. Не зберігайте plaintext-секрети – лише aliases (`secret-alias` + `bearerFromAlias`).
5. Тримайте `smoke.values.json` у sync з формою – smoke-тести мають бути відтворювані.
6. Використовуйте `npm run forms:lint` перед комітом – це перевірить JSON Schema та JSON Pointer.

## Міграція
1. Створіть `template.form.json` з `sample`/`default`.
2. Додайте `smoke.values.json` з робочими значеннями.
3. Запустіть `npm run build:all` (dev-прохід).
4. Для релізу – `npm run release:check` (prod, без WARN).

## Розширення
- Новий трансформ → `scripts/forms/build_canonical.mjs` + документація.
- Новий тип поля → `schemas/form_spec.schema.json` + UI.
- Додаткові перевірки → `scripts/forms/lint_bindings.mjs`.
