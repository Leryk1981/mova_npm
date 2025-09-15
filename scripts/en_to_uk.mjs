import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { resolve, dirname, basename, join } from 'path';
import { fileURLToPath } from 'url';

// --- Налаштування ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// --- Налаштування директорій ---
const inputDirRelativePath = 'canonical';
const inputDirFullPath = resolve(projectRoot, inputDirRelativePath);
if (!existsSync(inputDirFullPath)) {
  console.error(`❌ Помилка: Вхідну директорію не знайдено за шляхом: ${inputDirFullPath}`);
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

// --- Читання та обробка файлів ---
const allFiles = readdirSync(inputDirFullPath);
const allJsonFiles = allFiles.filter(file => file.endsWith('.json'));
const jsonFiles = allJsonFiles.filter(file => file.startsWith('plan_') || file.startsWith('route_'));
const ignoredFiles = allJsonFiles.filter(file => !jsonFiles.includes(file) && file !== 'manifest.json');

if (ignoredFiles.length > 0) {
  console.log('\n⚠️  Наступні .json файли було проігноровано через невідповідність імені:');
  ignoredFiles.forEach(f => console.log(`   - ${f}`));
  console.log('\n   Щоб файли були оброблені, їх імена мають починатися з "plan_" або "route_".\n');
}

if (jsonFiles.length === 0) {
  console.warn(`🤷 Не знайдено файлів для перекладу, що відповідають шаблону (plan_*.json, route_*.json) в директорії '${inputDirRelativePath}'.`);
  process.exit(0);
}

console.log(`--- Початок перекладу файлів з ${inputDirRelativePath} ---`);

jsonFiles.forEach(fileName => {
  const inputFileRelativePath = join(inputDirRelativePath, fileName);
  const inputFullPath = resolve(projectRoot, inputFileRelativePath);

  try {
    const enJsonContent = readFileSync(inputFullPath, 'utf-8');
    const enJson = JSON.parse(enJsonContent);
    const ukJson = translateObjectReverse(enJson);

    const baseFilename = basename(inputFileRelativePath);
    let outputFilename;
    if (baseFilename.startsWith('plan_')) {
        outputFilename = 'план_укр_' + baseFilename.substring('plan_'.length);
    } else if (baseFilename.startsWith('route_')) {
        outputFilename = 'маршрут_укр_' + baseFilename.substring('route_'.length);
    } else {
        // Цей випадок не має трапитись через фільтр вище, але для безпеки:
        outputFilename = baseFilename;
    }

    const outputFullPath = join(outputDir, outputFilename);
    writeFileSync(outputFullPath, JSON.stringify(ukJson, null, 2), 'utf-8');
    console.log(`✅ ${inputFileRelativePath} -> ${join('templates/ua/from-en', outputFilename)}`);
  } catch (error) {
    console.error(`❌ Помилка під час обробки файлу ${inputFileRelativePath}:`);
    console.error(error);
  }
});

console.log('--- Переклад завершено ---');