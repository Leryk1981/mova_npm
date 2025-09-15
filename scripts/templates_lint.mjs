import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

const canonicalKeysPath = resolve(root, 'build/canonical_keys.json');
if (!existsSync(canonicalKeysPath)) {
  console.error('❌ Файл build/canonical_keys.json не знайдено. Запустіть "npm run build:keys"');
  process.exit(1);
}

const canonicalKeys = new Set(JSON.parse(readFileSync(canonicalKeysPath, 'utf8')));
const inputDirRelativePath = process.argv[2];

if (!inputDirRelativePath) {
  console.error('Помилка: Вкажіть шлях до директорії з шаблонами.');
  process.exit(1);
}

const inputDirFullPath = resolve(root, inputDirRelativePath);
const files = readdirSync(inputDirFullPath).filter(f => f.endsWith('.json'));
let hasErrors = false;

function checkKeys(obj, filePath) {
  if (!obj) return;
  if (Array.isArray(obj)) return obj.forEach(item => checkKeys(item, filePath));
  if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      if (canonicalKeys.has(key)) {
        console.error(`❌ Помилка в ${filePath}: знайдено англійський структурний ключ "${key}".`);
        hasErrors = true;
      }
      // Do not recurse into the 'параметри' block, as it contains a raw JSON Schema
      // which uses English keywords like "type", "properties", etc.
      if (key !== 'параметри') {
        checkKeys(obj[key], filePath);
      }
    }
  }
}

console.log(`--- Лінтер шаблонів у ${inputDirRelativePath} ---`);
files.forEach(fileName => {
  const filePath = join(inputDirRelativePath, fileName);
  const content = JSON.parse(readFileSync(resolve(root, filePath), 'utf-8'));
  checkKeys(content, filePath);
});

if (hasErrors) process.exit(1);
console.log('✅ Усі шаблони пройшли перевірку.');