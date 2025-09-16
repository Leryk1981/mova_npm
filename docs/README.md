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
npm run scaffold:shopify:orders     # Створити Shopify бланк
npm run scaffold:jsonld:event       # Створити JSON-LD бланк
npm run scaffold:webhook:shopify    # Створити Shopify webhook
npm run scaffold:stripe:pi          # Створити Stripe Payment Intent
npm run scaffold:sendgrid:mail      # Створити SendGrid email
npm run scaffold:slack:message      # Створити Slack повідомлення
npm run scaffold:sheets:append      # Створити Google Sheets append
npm run scaffold:telegram:message   # Створити Telegram повідомлення
npm run scaffold:discord:message    # Створити Discord повідомлення
npm run scaffold:woo:orders         # Створити WooCommerce отримання замовлень
npm run scaffold:jsonld:localbiz    # Створити JSON-LD LocalBusiness
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

## Інтеграційні шаблони

### ТЗ-01: Shopify Webhook orders/create

**Мета:** Прийняти вебхук orders/create від Shopify з перевіркою HMAC та збереженням в NDJSON.

**Як заповнити:**
```bash
npm run scaffold:webhook:shopify
```

**Що робить:**
- Створює маршрут з HTTP POST тригером
- Перевіряє HMAC підпис через `shopify_verify_webhook`
- Зберігає payload в NDJSON файл через `file_append_jsonl`

**Очікуваний результат:**
```
✅ OK orders/create 1234567890
```

**Типові помилки:**
- `401 Unauthorized` - невірний HMAC підпис
- `File not found` - відсутній секрет SHOPIFY_WEBHOOK_SECRET

### ТЗ-02: Stripe Payment Intent

**Мета:** Створити Payment Intent у Stripe через API з безпечним зберіганням ключа.

**Як заповнити:**
```bash
npm run scaffold:stripe:pi
```

**Що робить:**
- Отримує API ключ через `secrets.get`
- Надсилає POST запит до Stripe API
- Повертає ID створеного Payment Intent

**Очікуваний результат:**
```
PaymentIntent: pi_xxxxxxxxxxxxxxxxxx
```

**Типові помилки:**
- `Authentication failed` - невірний API ключ
- `Invalid amount` - некоректна сума в мінорних одиницях

### ТЗ-03: SendGrid Email

**Мета:** Надіслати email через SendGrid API з правильним JSON тілом.

**Як заповнити:**
```bash
npm run scaffold:sendgrid:mail
```

**Що робить:**
- Отримує API ключ через `secrets.get`
- Надсилає POST запит до SendGrid API
- Підтримує HTML та plain text контент

**Очікуваний результат:**
```
SendGrid accepted (status in vars.sg_resp.__status)
```

**Типові помилки:**
- `401 Unauthorized` - невірний API ключ
- `400 Bad Request` - невалідний email формат

### ТЗ-04: Slack Incoming Webhook

**Мета:** Надіслати повідомлення в Slack через webhook.

**Як заповнити:**
```bash
npm run scaffold:slack:message
```

**Що робить:**
- Отримує webhook URL через `secrets.get`
- Надсилає POST запит до Slack з текстом та форматуванням
- Підтримує канал, ім'я користувача, emoji

**Очікуваний результат:**
```
Slack message sent (status: 200)
```

**Типові помилки:**
- `400 Bad Request` - невірний webhook URL
- `404 Not Found` - канал не існує

### ТЗ-05: Google Sheets Append Row

**Мета:** Додати рядок у Google Sheets для логування даних.

**Як заповнити:**
```bash
npm run scaffold:sheets:append
```

**Що робить:**
- Отримує API ключ через `secrets.get`
- Використовує Google Sheets API для додавання рядка
- Підтримує spreadsheetId, range та масив даних

**Очікуваний результат:**
```
Row appended to Google Sheets (status: 200)
```

**Типові помилки:**
- `403 Forbidden` - недостатньо прав доступу
- `404 Not Found` - таблиця не існує

### ТЗ-06: Telegram Bot Send Message

**Мета:** Надіслати повідомлення користувачу/каналу в Telegram.

**Як заповнити:**
```bash
npm run scaffold:telegram:message
```

**Що робить:**
- Отримує bot token через `secrets.get`
- Надсилає POST запит до Telegram Bot API
- Підтримує HTML/Markdown форматування

**Очікуваний результат:**
```
Telegram message sent (status: 200)
```

**Типові помилки:**
- `401 Unauthorized` - невірний bot token
- `403 Forbidden` - бот заблокований користувачем

### ТЗ-07: Discord Webhook — надсилання повідомлення

**Мета:** Надіслати повідомлення у Discord-канал через Incoming Webhook URL з мінімальними, але правильними полями.

**Як заповнити:**
```bash
npm run scaffold:discord:message
```

**Що робить:**
- Отримує webhook URL через `secrets.get`
- Надсилає POST запит до Discord з JSON тілом
- Підтримує текст, ім'я користувача, аватар

**Очікуваний результат:**
```
Discord accepted (status in vars.resp.__status)
```

**Типові помилки:**
- `400 Bad Request` - невірний webhook URL або відсутній content
- `404 Not Found` - webhook не існує

### ТЗ-08: WooCommerce — отримання замовлень (REST API)

**Мета:** Отримати список замовлень із WooCommerce через REST API з підтримкою автентифікації та пагінації.

**Як заповнити:**
```bash
npm run scaffold:woo:orders
```

**Що робить:**
- Отримує consumer key/secret через `secrets.get`
- Надсилає GET запити до WooCommerce API з пагінацією
- Зберігає замовлення в NDJSON файл

**Очікуваний результат:**
```
NDJSON файл з замовленнями
```

**Типові помилки:**
- `401 Unauthorized` - невірні креденшли
- `403 Forbidden` - недостатньо прав доступу

### ТЗ-09: JSON-LD LocalBusiness — SEO-картка для локального бізнесу

**Мета:** Згенерувати JSON-LD опис локального бізнесу для SEO з підтримкою schema.org.

**Як заповнити:**
```bash
npm run scaffold:jsonld:localbiz
```

**Що робить:**
- Створює JSON-LD payload з полями LocalBusiness
- Записує у .jsonld файл
- Підтримує адресу, телефон, години роботи

**Очікуваний результат:**
```
JSON-LD LocalBusiness збережено у <OUT_FILE>
```

**Типові помилки:**
- Валідаційна помилка - відсутній @context або обов'язкові поля

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