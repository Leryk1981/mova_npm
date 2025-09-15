import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname, basename, join } from 'path';
import { fileURLToPath } from 'url';

// --- Налаштування ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// --- Отримання вхідного файлу ---
const inputFileRelativePath = process.argv[2];
if (!inputFileRelativePath) {
  console.error('❌ Помилка: Вкажіть шлях до канонічного англомовного файлу для перекладу.');
  process.exit(1);
}

const inputFullPath = resolve(projectRoot, inputFileRelativePath);
if (!existsSync(inputFullPath)) {
  console.error(`❌ Помилка: Вхідний файл не знайдено за шляхом: ${inputFullPath}`);
  process.exit(1);
}

// --- Завантаження та інвертування словника ---
const lexiconPath = resolve(projectRoot, 'lexicon_uk.json');
const lexicon = JSON.parse(readFileSync(lexiconPath, 'utf-8'));
const allowlistPath = resolve(projectRoot, 'allowlist_structural.json');
const structural_uk = new Set(JSON.parse(readFileSync(allowlistPath, 'utf-8')));

const invertedValueLexicon = {};
const invertedStructuralLexicon = {};

for (const ukKey in lexicon) {
    const enKey = lexicon[ukKey];
    if (structural_uk.has(ukKey)) {
        invertedStructuralLexicon[enKey] = ukKey;
    } else {
        invertedValueLexicon[enKey] = ukKey;
    }
}

// Для значень ми надаємо перевагу перекладу для значень (неструктурних), але використовуємо структурний як запасний
const fullInvertedValueLexicon = { ...invertedStructuralLexicon, ...invertedValueLexicon };

// --- Рекурсивна функція для зворотного перекладу ---
function translateObjectReverse(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => translateObjectReverse(item));
  }
  if (obj !== null && typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      const translatedKey = invertedStructuralLexicon[key] || key;
      let value = translateObjectReverse(obj[key]);

      // Якщо оригінальний ключ був 'type', перекладаємо і його значення
      if (key === 'type' && typeof value === 'string') {
        value = fullInvertedValueLexicon[value] || value;
      }

      newObj[translatedKey] = value;
    }
    return newObj;
  }
  return obj;
}

// --- Створення директорії для результату ---
const outputDir = resolve(projectRoot, 'templates/ua/from-en');
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
  console.log(`📂 Створено директорію: ${outputDir}`);
}

// --- Обробка файлу ---
console.log(`--- Початок перекладу файлу ${inputFileRelativePath} ---`);

try {
  const enJsonContent = readFileSync(inputFullPath, 'utf-8');
  const enJson = JSON.parse(enJsonContent);
  const ukJson = translateObjectReverse(enJson);

  const baseFilename = basename(inputFileRelativePath);
  const outputFilename = baseFilename
    .replace('plan_', 'план_укр_')
    .replace('route_', 'маршрут_укр_');

  const outputFullPath = join(outputDir, outputFilename);
  writeFileSync(outputFullPath, JSON.stringify(ukJson, null, 2), 'utf-8');
  console.log(`✅ ${inputFileRelativePath} -> ${join('templates/ua/from-en', outputFilename)}`);
} catch (error) {
  console.error(`❌ Помилка під час обробки файлу ${inputFileRelativePath}:`);
  console.error(error);
  process.exit(1);
}

console.log('--- Переклад завершено ---');