import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import { validationError } from '../error_wrap.mjs';
import { compileUAtoEnvelope } from './compile.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..');
const casesDir = path.join(root, 'tests', 'negative', 'cases');

const cases = (await fs.readdir(casesDir))
  .filter(name => name.endsWith('.ua.txt'))
  .sort();

let failed = 0;

for (const fileName of cases) {
  const ua = (await fs.readFile(path.join(casesDir, fileName), 'utf8')).trim();
  try {
    await compileUAtoEnvelope(ua);
    console.error(`FAIL expected 422: ${fileName}`);
    failed++;
  } catch (error) {
    const details = (error?.errors || []).map(detail => ({
      path: detail.instancePath || detail.schemaPath || '',
      message: detail.message || 'Validation error'
    }));
    const wrapped = validationError('Validation failed', details);
    if (wrapped.status !== 422) {
      console.error(`FAIL non-422: ${fileName}`);
      failed++;
    } else {
      console.log(`Expected failure for ${fileName}: ${JSON.stringify(wrapped.body)}`);
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log(`Negative OK: ${cases.length}/${cases.length}`);
