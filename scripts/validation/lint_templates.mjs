import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { resolve, dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '../..');

const canonicalKeysPath = resolve(root, 'build/canonical_keys.json');
if (!existsSync(canonicalKeysPath)) {
  console.error('❌ Файл build/canonical_keys.json не знайдено. Запустіть "npm run build:keys"');
  process.exit(1);
}

const canonicalKeys = new Set(JSON.parse(readFileSync(canonicalKeysPath, 'utf8')));
const disallowedActionKeys = new Set(['content_type', 'contentType', 'payload_media_type', 'тип_навантаження']);
const actionContainers = new Set(['дії', 'actions']);

const inputDirRelativePath = process.argv[2];

if (!inputDirRelativePath) {
  console.error('Помилка: Вкажіть шлях до директорії з шаблонами.');
  process.exit(1);
}

const inputDirFullPath = resolve(root, inputDirRelativePath);

// Визначаємо, чи це мовна директорія
const isLanguageDir = inputDirRelativePath.includes('templates/ua') ||
                      inputDirRelativePath.includes('templates/de') ||
                      inputDirRelativePath.includes('templates/fr') ||
                      inputDirRelativePath.includes('templates/pl') ||
                      inputDirRelativePath === 'templates/ua' ||
                      inputDirRelativePath === 'templates/de' ||
                      inputDirRelativePath === 'templates/fr' ||
                      inputDirRelativePath === 'templates/pl';

function findJsonFiles(startPath) {
  let results = [];
  const files = readdirSync(startPath);
  for (const file of files) {
    const filename = join(startPath, file);
    const stat = statSync(filename);
    if (stat.isDirectory()) {
      results = results.concat(findJsonFiles(filename));
    } else if (filename.endsWith('.json')) {
      results.push(filename);
    }
  }
  return results;
}

const files = findJsonFiles(inputDirFullPath);
let hasErrors = false;

function isInsideActions(ancestors) {
  return ancestors.some(part => actionContainers.has(part));
}

function formatPath(segments) {
  return segments
    .map(segment => (typeof segment === 'number' ? `[${segment}]` : segment))
    .join('.');
}

function checkKeys(obj, filePath, ancestors = []) {
  if (obj === null || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => checkKeys(item, filePath, ancestors.concat(index)));
    return;
  }

  for (const key of Object.keys(obj)) {
    const nextAncestors = ancestors.concat(key);

    if (isLanguageDir && !key.startsWith('@') && canonicalKeys.has(key) && !currentAllowlist.has(key)) {
      console.error(`❌ Помилка в ${filePath}: знайдено заборонений англійський структурний ключ "${key}".`);
      hasErrors = true;
    }

    if (isInsideActions(ancestors) && disallowedActionKeys.has(key)) {
      const pathString = formatPath(nextAncestors);
      console.error(`❌ Помилка в ${filePath}: поле "${key}" заборонено всередині дій (шлях: ${pathString}).`);
      hasErrors = true;
    }

    if (key !== 'параметри') {
      checkKeys(obj[key], filePath, nextAncestors);
    }
  }
}

console.log(`--- Лінтер шаблонів у ${inputDirRelativePath} ---`);
console.log(`Is language dir: ${isLanguageDir}`);

// Завантажуємо allowlist для поточної мови
let currentAllowlist = new Set();
if (isLanguageDir) {
  const lang = inputDirRelativePath.split('/').pop() || inputDirRelativePath.split('\\').pop();
  const allowlistPath = resolve(root, `allowlist_structural${lang === 'ua' ? '' : '_' + lang}.json`);
  console.log(`Loading allowlist for lang ${lang}: ${allowlistPath}`);
  if (existsSync(allowlistPath)) {
    currentAllowlist = new Set(JSON.parse(readFileSync(allowlistPath, 'utf8')));
    console.log(`Loaded ${currentAllowlist.size} keys from allowlist`);
  } else {
    console.log(`Allowlist file not found: ${allowlistPath}`);
  }
}
files.forEach(fullPath => {
  const filePath = relative(root, fullPath);
  const fileContent = readFileSync(fullPath, 'utf-8');

  if (fileContent.trim() === '') {
    console.warn(`⚠️  Файл ${filePath} порожній і буде проігнорований.`);
    return;
  }

  try {
    const content = JSON.parse(fileContent);
    checkKeys(content, filePath);
  } catch (e) {
    console.error(`❌ Помилка парсингу JSON у файлі ${filePath}: ${e.message}`);
    hasErrors = true;
  }
});

if (hasErrors) process.exit(1);
console.log('✅ Усі шаблони пройшли перевірку.');

