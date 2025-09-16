import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, basename, join, relative } from 'path';
import { fileURLToPath } from 'url';

// Визначаємо кореневу директорію проєкту
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../..');

const inputPathArg = process.argv[2];
const outputPathArg = process.argv[3];

if (!inputPathArg) {
  console.error('Помилка: Будь ласка, вкажіть шлях до файлу або директорії з українськими шаблонами.');
  process.exit(1);
}

const inputFullPath = resolve(projectRoot, inputPathArg);
if (!existsSync(inputFullPath)) {
  console.error(`❌ Помилка: Вхідний шлях не знайдено: ${inputFullPath}`);
  process.exit(1);
}

const inputStat = statSync(inputFullPath);

const explicitOutputPath = outputPathArg ? resolve(projectRoot, outputPathArg) : null;
if (explicitOutputPath && inputStat.isDirectory()) {
  console.error('❌ Помилка: Коли вказано вихідний файл, вхід має бути одним JSON-файлом.');
  process.exit(1);
}

// 2. Завантажуємо словник і allowlist один раз
const lexiconPath = resolve(projectRoot, 'lexicon_uk.json');
const lexicon = JSON.parse(readFileSync(lexiconPath, 'utf-8'));
const allowlist = new Set(JSON.parse(readFileSync(resolve(projectRoot, 'allowlist_structural.json'), 'utf-8')));

// Рекурсивна функція для пошуку всіх .json файлів
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

function translateObject(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => translateObject(item));
  }
  if (obj !== null && typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      const translatedKey = allowlist.has(key) ? (lexicon[key] || key) : key;
      let value = translateObject(obj[key]);

      if (translatedKey === 'type' && typeof value === 'string') {
        value = lexicon[value] || value;
      }

      newObj[translatedKey] = value;
    }
    return newObj;
  }
  return obj;
}

const filesToProcess = [];
if (inputStat.isDirectory()) {
  filesToProcess.push(...findJsonFiles(inputFullPath));
} else if (inputFullPath.endsWith('.json')) {
  filesToProcess.push(inputFullPath);
} else {
  console.error('❌ Помилка: Вхід має бути директорією або .json файлом.');
  process.exit(1);
}

if (filesToProcess.length === 0) {
  console.warn(`⚠️  Не знайдено жодного .json файлу у ${inputPathArg}`);
  process.exit(0);
}

let outputDir;
if (!explicitOutputPath) {
  outputDir = resolve(projectRoot, 'canonical');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
    console.log(`Створено директорію: ${outputDir}`);
  }
} else {
  const parentDir = dirname(explicitOutputPath);
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true });
  }
}

console.log(`--- Початок трансляції з ${inputPathArg} ---`);

filesToProcess.forEach(inputPath => {
  const inputRelativePath = relative(projectRoot, inputPath);

  try {
    const ukJsonContent = readFileSync(inputPath, 'utf-8');
    if (ukJsonContent.trim() === '') {
      console.warn(`⚠️  Файл ${inputRelativePath} порожній і буде проігнорований.`);
      return;
    }
    const ukJson = JSON.parse(ukJsonContent);
    const enJson = translateObject(ukJson);

    let outputFullPath;
    if (explicitOutputPath) {
      outputFullPath = explicitOutputPath;
    } else {
      const outputFilename = basename(inputPath)
        .replace('план_укр', 'plan')
        .replace('маршрут_укр', 'route')
        .replace('_укр', '');
      outputFullPath = join(outputDir, outputFilename);
    }

    writeFileSync(outputFullPath, JSON.stringify(enJson, null, 2), 'utf-8');
    const outputRelative = relative(projectRoot, outputFullPath);
    console.log(`✅ ${inputRelativePath} -> ${outputRelative}`);
  } catch (error) {
    console.error(`❌ Помилка під час обробки файлу ${inputRelativePath}:`);
    console.error(error);
  }
});

console.log('--- Трансляцію завершено ---');
