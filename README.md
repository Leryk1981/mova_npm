# UA JSON Language for MOVA

**Мета:** зробити JSON-артефакти зрозумілими українською мовою для автора системи.  
**Підхід:** *людський шар українською* → автоматична трансляція → *канонічні схеми англійською* (JSON Schema 2020-12, AJV).

## Як це працює
- Ви пишете плани/маршрути українською (див. `templates/ua/*`).
- Скрипт `scripts/uk_to_en.mjs` перекладає ключі за словником `lexicon_uk.json`.
- Канонічний JSON валідовується проти офіційних схем MOVA (англійською).

## Чому так
- Людині — рідна мова і прозорі смисли.
- Машині — стабільні англомовні контракти, інструменти, CI.

## Language & i18n policy
- The MOVA CLI speaks canonical English by default for all user-facing hints.
- Select a locale with `--lang <code>` or the `MOVA_LANG` environment variable (`--lang` wins when both are set).
- The CLI normalizes the resolved locale into `MOVA_LANG` so child processes observe the same setting after fallbacks.
- Only `en` is currently available; unsupported language codes emit a warning and fall back to English.
- Schemas, identifiers, keys, and parameter names stay in English. Additional locales are introduced on demand when high-quality translations are ready.

## Стандарти
- JSON Schema 2020-12 — структурна валідація.
- OpenAPI 3.1 — опис HTTP інтерфейсів (у CI).
- JSON-LD 1.1 + schema.org — семантичний шар (опційно).
- CloudEvents 1.0 — універсальний формат подій (вхід/вихід).

Деталі — у `specs/0002-standards-and-boundaries.md`.

## Швидкий старт
```bash
npm i
npm run build:ua
# далі провалідуйте канонічні файли вашим валідатором MOVA
```

## Словник

Див. `lexicon_uk.json`. Додавайте пари для нових ключів та дій.

## Ліцензія

MIT — див. `LICENSE`.