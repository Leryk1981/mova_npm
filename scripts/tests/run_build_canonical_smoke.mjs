import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_PORT = process.env.MOVA_UI_PORT ?? '3001';
const BASE_URL = process.env.MOVA_UI_BASE ?? `http://localhost:${DEFAULT_PORT}`;

async function postJSON(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }
  return { status: response.status, body: parsed };
}

if (typeof fetch !== 'function') {
  throw new Error('Global fetch is not available in this Node runtime');
}

(async () => {
  const minimalPayload = {
    formSpec: {
      id: 'slack_send_message',
      form: {
        SLACK_WEBHOOK_NAME: 'SLACK_WEBHOOK_URL',
        MESSAGE_TEXT: 'Smoke hello',
        CHANNEL: '#general',
        USERNAME: 'SmokeBot',
        ICON_EMOJI: ':wave:'
      }
    },
    mode: 'dev'
  };

  const responseA = await postJSON(`${BASE_URL}/api/build-canonical`, minimalPayload);
  assert.equal(responseA.status, 200, `Expected 200, got ${responseA.status}: ${JSON.stringify(responseA.body)}`);
  assert.ok(responseA.body?.canonical?.mova_version, 'Missing mova_version in canonical response');
  assert.ok(Array.isArray(responseA.body?.canonical?.actions), 'Actions array missing in canonical response');

  const templatePath = path.resolve(__dirname, '..', '..', 'templates', 'forms', 'slack_send_message', 'template.form.json');
  const template = JSON.parse(await readFile(templatePath, 'utf8'));

  const responseB = await postJSON(`${BASE_URL}/api/build-canonical`, {
    formSpec: template,
    formValues: {
      SLACK_WEBHOOK_NAME: 'SLACK_WEBHOOK_URL',
      MESSAGE_TEXT: 'Smoke direct',
      CHANNEL: '#smoke',
      USERNAME: 'SmokeBot',
      ICON_EMOJI: ':rocket:'
    },
    mode: 'dev'
  });

  assert.equal(responseB.status, 200, `Expected 200, got ${responseB.status}: ${JSON.stringify(responseB.body)}`);
  assert.ok(responseB.body?.canonical?.mova_version, 'Missing mova_version in canonical response (direct)');
  assert.ok(Array.isArray(responseB.body?.canonical?.actions), 'Actions array missing in canonical response (direct)');

  console.log('build-canonical smoke OK');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
