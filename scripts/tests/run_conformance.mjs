import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { compileUAtoEnvelope } from './compile.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..');
const casesDir = path.join(root, 'tests', 'conformance', 'vnl_smoke');

const files = (await fs.readdir(casesDir))
  .filter(name => name.endsWith('.ua.txt'))
  .sort();

let failed = 0;

for (const fileName of files) {
  const base = fileName.replace(/\.ua\.txt$/u, '');
  const uaPath = path.join(casesDir, `${base}.ua.txt`);
  const expectedPath = path.join(casesDir, `${base}.expected.json`);
  const ua = (await fs.readFile(uaPath, 'utf8')).trim();
  const expectedRaw = await fs.readFile(expectedPath, 'utf8');
  const expected = JSON.parse(expectedRaw);
  try {
    const actual = await compileUAtoEnvelope(ua);
    assert.deepEqual(actual, expected);
    console.log(`OK ${base}`);
  } catch (error) {
    console.error(`DIFF: ${base}`);
    console.error(error);
    failed++;
  }
}

if (failed) {
  process.exit(1);
}

console.log(`Conformance OK: ${files.length}/${files.length}`);
