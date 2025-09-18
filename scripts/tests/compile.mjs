import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

const KNOWN_VERBS = new Set(['надішли', 'створи', 'додай', 'зроби']);
const KNOWN_CHANNEL_SERVICES = new Set(['slack', 'telegram']);
const KNOWN_HTTP_METHODS = new Set(['GET', 'POST']);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validationFailure(message, instancePath = '') {
  const error = new Error(message);
  error.status = 422;
  error.errors = [
    {
      instancePath,
      message
    }
  ];
  return error;
}

function buildSlackMessage({ channel, text }) {
  return {
    mova_version: '3.3',
    description: `Slack повідомлення до #${channel}`,
    actions: [
      {
        type: 'http_request',
        invoke: 'http:request',
        payload: {
          url: 'https://slack.com/api/chat.postMessage',
          method: 'POST',
          headers: {
            Authorization: 'Bearer {env.SLACK_BOT_TOKEN}',
            'Content-Type': 'application/json; charset=utf-8'
          },
          body: {
            channel: `#${channel}`,
            text
          },
          result_in: 'vars.slack'
        }
      }
    ]
  };
}

function buildTelegramMessage({ chatId, text }) {
  return {
    mova_version: '3.3',
    actions: [
      {
        type: 'http_request',
        invoke: 'http:request',
        payload: {
          url: 'https://api.telegram.org/bot{env.TELEGRAM_BOT_TOKEN}/sendMessage',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            chat_id: chatId,
            text
          },
          result_in: 'vars.telegram'
        }
      }
    ]
  };
}

function buildEmail({ to, subject, body }) {
  return {
    mova_version: '3.3',
    actions: [
      {
        type: 'http_request',
        invoke: 'http:request',
        payload: {
          url: 'https://api.sendgrid.com/v3/mail/send',
          method: 'POST',
          headers: {
            Authorization: 'Bearer {env.SENDGRID_TOKEN}',
            'Content-Type': 'application/json'
          },
          body: {
            personalizations: [
              {
                to: [
                  { email: to }
                ],
                subject
              }
            ],
            from: {
              email: 'no-reply@mova.dev',
              name: 'MOVA Automations'
            },
            content: [
              {
                type: 'text/plain',
                value: body
              }
            ]
          }
        }
      }
    ]
  };
}

function buildNotionTask({ database, title }) {
  return {
    mova_version: '3.3',
    actions: [
      {
        type: 'http_request',
        invoke: 'http:request',
        payload: {
          url: 'https://api.notion.com/v1/pages',
          method: 'POST',
          headers: {
            Authorization: 'Bearer {env.NOTION_TOKEN}',
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28'
          },
          body: {
            parent: {
              database_id: database
            },
            properties: {
              Name: {
                title: [
                  {
                    text: {
                      content: title
                    }
                  }
                ]
              }
            }
          }
        }
      }
    ]
  };
}

function buildCalendarEvent({ title, date, time }) {
  return {
    mova_version: '3.3',
    actions: [
      {
        type: 'http_request',
        invoke: 'http:request',
        payload: {
          url: 'https://www.googleapis.com/calendar/v3/calendars/primary/events',
          method: 'POST',
          headers: {
            Authorization: 'Bearer {env.GOOGLE_CALENDAR_TOKEN}',
            'Content-Type': 'application/json'
          },
          body: {
            summary: title,
            start: {
              dateTime: `${date}T${time}:00Z`
            },
            end: {
              dateTime: `${date}T${time}:00Z`
            }
          }
        }
      }
    ]
  };
}

function buildSheetAppend({ sheet, values }) {
  return {
    mova_version: '3.3',
    actions: [
      {
        type: 'http_request',
        invoke: 'http:request',
        payload: {
          url: `https://sheets.googleapis.com/v4/spreadsheets/${sheet}/values/A:A:append?valueInputOption=USER_ENTERED`,
          method: 'POST',
          headers: {
            Authorization: 'Bearer {env.GOOGLE_SHEETS_TOKEN}',
            'Content-Type': 'application/json'
          },
          body: {
            values: [values]
          }
        }
      }
    ]
  };
}

function buildStripePayment({ amount, description }) {
  return {
    mova_version: '3.3',
    actions: [
      {
        type: 'http_request',
        invoke: 'http:request',
        payload: {
          url: 'https://api.stripe.com/v1/payment_intents',
          method: 'POST',
          headers: {
            Authorization: 'Bearer {env.STRIPE_SECRET}',
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: {
            amount,
            currency: 'usd',
            description
          },
          result_in: 'vars.stripe'
        }
      }
    ]
  };
}

function buildGitHubIssue({ repo, title, description }) {
  return {
    mova_version: '3.3',
    actions: [
      {
        type: 'http_request',
        invoke: 'http:request',
        payload: {
          url: `https://api.github.com/repos/${repo}/issues`,
          method: 'POST',
          headers: {
            Authorization: 'Bearer {env.GITHUB_TOKEN}',
            'Content-Type': 'application/json',
            'User-Agent': 'mova-automation'
          },
          body: {
            title,
            body: description
          }
        }
      }
    ]
  };
}

function buildHttpRequest({ method, url, body }) {
  const payload = {
    url,
    method
  };
  if (body !== undefined) {
    payload.body = body;
    payload.headers = {
      'Content-Type': 'application/json'
    };
  }
  return {
    mova_version: '3.3',
    actions: [
      {
        type: 'http_request',
        invoke: 'http:request',
        payload
      }
    ]
  };
}

const MATCHERS = [
  {
    id: 'slack-message',
    pattern: /^надішли повідомлення в slack канал ([\w-]+) текст "(.+)"$/iu,
    build: ([, channel, text]) => buildSlackMessage({ channel, text })
  },
  {
    id: 'telegram-message',
    pattern: /^надішли повідомлення в telegram чат (\S+) текст "(.+)"$/iu,
    build: ([, chatId, text]) => buildTelegramMessage({ chatId, text })
  },
  {
    id: 'send-email',
    pattern: /^надішли email на (\S+) тема "(.+?)" текст "(.+)"$/iu,
    build: ([, to, subject, body]) => buildEmail({ to, subject, body })
  },
  {
    id: 'notion-task',
    pattern: /^створи задачу в notion база (\S+) назва "(.+)"$/iu,
    build: ([, database, title]) => buildNotionTask({ database, title })
  },
  {
    id: 'calendar-event',
    pattern: /^створи подію в google calendar назва "(.+?)" дата (\d{4}-\d{2}-\d{2}) час (\d{2}:\d{2})$/iu,
    build: ([, title, date, time]) => buildCalendarEvent({ title, date, time })
  },
  {
    id: 'sheet-append',
    pattern: /^додай рядок в google sheets таблиця (\S+) значення "(.+)"$/iu,
    build: ([, sheet, rawValues]) => {
      const values = rawValues.split(',').map(part => part.trim().replace(/^"|"$/g, ''));
      return buildSheetAppend({ sheet, values });
    }
  },
  {
    id: 'stripe-payment',
    pattern: /^створи оплату в stripe сума (\d+) опис "(.+)"$/iu,
    build: ([, amount, description]) => buildStripePayment({ amount, description })
  },
  {
    id: 'github-issue',
    pattern: /^створи issue в github репозиторій (\S+) назва "(.+?)" опис "(.+)"$/iu,
    build: ([, repo, title, description]) => buildGitHubIssue({ repo, title, description })
  },
  {
    id: 'http-get',
    pattern: /^зроби запит http get (https?:\/\/\S+)$/iu,
    build: ([, url]) => buildHttpRequest({ method: 'GET', url })
  },
  {
    id: 'http-post',
    pattern: /^зроби запит http post (https?:\/\/\S+) тіло "(.+)"$/iu,
    build: ([, url, body]) => {
      let parsed = body;
      try {
        parsed = JSON.parse(body);
      } catch {
        parsed = body;
      }
      return buildHttpRequest({ method: 'POST', url, body: parsed });
    }
  }
];

export async function compileUAtoEnvelope(rawInput) {
  const input = rawInput.trim();
  if (!input) {
    throw validationFailure('Команда порожня', '/');
  }

  const verb = input.split(/\s+/u)[0]?.toLowerCase();
  if (verb && !KNOWN_VERBS.has(verb)) {
    throw validationFailure(`Невідоме дієслово: "${verb}"`, '/verb');
  }

  const slackWithoutText = /^надішли повідомлення в slack канал (\S+)$/iu;
  if (slackWithoutText.test(input)) {
    throw validationFailure('Бракує частини "текст" для Slack повідомлення', '/text');
  }

  const unknownChannelService = /^надішли повідомлення в (\S+) канал (\S+) текст "(.+)"$/iu;
  const unknownMatch = unknownChannelService.exec(input);
  if (unknownMatch) {
    const service = unknownMatch[1].toLowerCase();
    if (!KNOWN_CHANNEL_SERVICES.has(service)) {
      throw validationFailure(`Невідома платформа для повідомлень: "${service}"`, '/platform');
    }
  }

  if (/пріоритет\s+\S+/iu.test(input)) {
    throw validationFailure('Поле "пріоритет" не підтримується для цієї команди', '/priority');
  }

  const stripeAmount = /^створи оплату в stripe сума (\S+) опис/iu;
  const amountMatch = stripeAmount.exec(input);
  if (amountMatch) {
    const amount = amountMatch[1];
    if (!/^\d+$/.test(amount)) {
      throw validationFailure('Сума Stripe повинна бути числом у центах', '/amount');
    }
  }

  if (/^надішли повідомлення в канал /iu.test(input)) {
    throw validationFailure('Не вказано сервіс (slack/telegram)', '/platform');
  }

  const httpMatch = /^зроби запит http (\w+)/iu.exec(input);
  if (httpMatch) {
    const method = httpMatch[1].toUpperCase();
    if (!KNOWN_HTTP_METHODS.has(method)) {
      throw validationFailure(`HTTP метод "${method}" не підтримується`, '/method');
    }
  }

  for (const matcher of MATCHERS) {
    const match = matcher.pattern.exec(input);
    if (match) {
      const result = matcher.build(match);
      return clone(result);
    }
  }

  throw validationFailure('Команда не підтримується', '/');
}

export function resolveProjectRoot() {
  return projectRoot;
}
