# Многоязычный слой MOVA

## Огляд

MOVA підтримує розробку планів та маршрутів рідною мовою розробника. Система автоматично транслює мовні файли в канонічний англійський JSON, який проходить валідацію та виконується рантаймом.

## Підтримувані мови

- **Українська (uk)** - повна підтримка
- **Німецька (de)** - базова підтримка
- **Англійська (en)** - канонічна мова системи

## Швидкий старт

### 1. Створіть мовний файл

```json
// templates/ua/my_plan.json
{
  "версія": "3.3",
  "дії": [
    {
      "тип": "print",
      "повідомлення": "Привіт MOVA!"
    }
  ]
}
```

### 2. Транслюйте в канонічний формат

```bash
npm run translate:ua
```

### 3. Валідуйте результат

```bash
npm run validate:canonical
```

### 4. Запустіть план

```bash
npm run run templates/canonical/my_plan.canonical.json
```

## Структура проекту

```
mova/
├── lexicon_uk.json          # Лексикон український
├── lexicon_de.json          # Лексикон німецький
├── allowlist_structural_*.json  # Дозволені ключі
├── templates/
│   ├── ua/                  # Українські шаблони
│   ├── de/                  # Німецькі шаблони
│   ├── blank/               # Порожні бланки
│   └── canonical/           # Згенеровані канонічні файли
├── scripts/
│   ├── translation/         # Скрипти трансляції
│   ├── validation/          # Скрипти валідації
│   └── build/               # Скрипти збірки
└── schemas/                 # JSON Schema для валідації
```

## Лексикони

Лексикон - це мапа локалізований_ключ → canonical_key.

### Український приклад:
```json
{
  "версія": "mova_version",
  "дії": "actions",
  "тип": "type",
  "повідомлення": "message"
}
```

## Команди

### Збірка
```bash
npm run build:all              # Повна збірка UA
npm run build:all:with-de      # Повна збірка UA + DE
npm run build:keys             # Зібрати канонічні ключі
npm run check:lexicon          # Перевірити покриття лексикону
```

### Трансляція
```bash
npm run translate:ua           # Транслювати UA файли
npm run translate:de           # Транслювати DE файли
```

### Валідація
```bash
npm run lint:ua                # Лінт UA файлів
npm run lint:de                # Лінт DE файлів
npm run validate:canonical     # Валідація канонічних файлів
```

### Підстановка
```bash
npm run scaffold:shopify:orders  # Створити Shopify бланк
npm run scaffold:jsonld:event    # Створити JSON-LD бланк
```

## Бланки (Blank Templates)

### Мінімальний конверт
```bash
node scripts/scaffold.mjs templates/blank/ua/envelope_min_blank.json templates/ua/my_envelope.json повідомлення="Моє повідомлення"
```

### Shopify замовлення
```bash
node scripts/scaffold.mjs templates/blank/ua/shopify_orders_blank.json templates/ua/shopify_orders.json
```

## Розширення файлів

- `.json` - мовні файли (ua, de)
- `.canonical.json` - канонічні файли (en)
- `.blank.json` - порожні шаблони з плейсхолдерами

## Плейсхолдери

У бланках використовуються плейсхолдери у форматі `<KEY>`:

```json
{
  "повідомлення": "<ВАШЕ_ПОВІДОМЛЕННЯ>"
}
```

## Валідація

Система перевіряє:
- Відсутність англійських структурних ключів у мовних файлах
- Покриття лексикону всіма канонічними ключами
- Відсутність плейсхолдерів перед трансляцією
- Відповідність канонічних файлів JSON Schema

## CI/CD

### Джоби:
1. `build:keys` - збірка канонічних ключів
2. `check:lexicon` - перевірка покриття лексикону
3. `lint` - лінтинг мовних файлів
4. `translate` - трансляція в канонічний формат
5. `validate` - валідація канонічних файлів
6. `smoke` - smoke-тестування

## Безпека

- Секрети не зберігаються в репозиторії
- Використовуйте дію `secrets.get` для доступу до секретів
- Логи не друкують секретні значення

## Розширення на нові мови

1. Створіть `lexicon_<lang>.json`
2. Створіть `allowlist_structural_<lang>.json`
3. Додайте бланки в `templates/blank/<lang>/`
4. Оновіть `translate.mjs` для підтримки нової мови
5. Додайте npm скрипти для нової мови