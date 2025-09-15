import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, basename, join, relative } from 'path';
import { fileURLToPath } from 'url';

// Визначаємо кореневу директорію проєкту
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// 1. Отримуємо вхідну ДИРЕКТОРІЮ з аргументів командного рядка
const inputDirRelativePath = process.argv[2];
if (!inputDirRelativePath) {
  console.error('Помилка: Будь ласка, вкажіть шлях до директорії з українськими шаблонами.');
  process.exit(1);
}

const inputDirFullPath = resolve(projectRoot, inputDirRelativePath);
if (!existsSync(inputDirFullPath)) {
  console.error(`❌ Помилка: Вхідну директорію не знайдено за шляхом: ${inputDirFullPath}`);
  process.exit(1);
}

// 2. Завантажуємо словник один раз
const lexiconPath = resolve(projectRoot, 'lexicon_uk.json');
const lexicon = JSON.parse(readFileSync(lexiconPath, 'utf-8'));

const allowlist = new Set(JSON.parse(readFileSync(resolve(projectRoot, 'allowlist_structural.json'), 'utf-8')));

// 3. Рекурсивна функція для трансляції ключів
function translateObject(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => translateObject(item));
  }
  if (obj !== null && typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      const translatedKey = allowlist.has(key) ? (lexicon[key] || key) : key;
      let value = translateObject(obj[key]);

      // Якщо ключ - 'type', перекладаємо і його значення
      if (translatedKey === 'type' && typeof value === 'string') {
        value = lexicon[value] || value;
      }

      newObj[translatedKey] = value;
    }
    return newObj;
  }
  return obj;
}

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

// 4. Створюємо директорію для канонічних файлів
const outputDir = resolve(projectRoot, 'canonical');
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
  console.log(`Створено директорію: ${outputDir}`);
}

// 5. Читаємо та обробляємо всі файли з директорії
const jsonFiles = findJsonFiles(inputDirFullPath);

if (jsonFiles.length === 0) {
  console.warn(`⚠️  Не знайдено жодного .json файлу в директорії ${inputDirRelativePath}`);
  process.exit(0);
}

console.log(`--- Початок трансляції файлів з ${inputDirRelativePath} ---`);

jsonFiles.forEach(inputFullPath => {
  const inputFileRelativePath = relative(projectRoot, inputFullPath);

  try {
    const ukJsonContent = readFileSync(inputFullPath, 'utf-8');
    if (ukJsonContent.trim() === '') {
      console.warn(`⚠️  Файл ${inputFileRelativePath} порожній і буде проігнорований.`);
      return; // Пропускаємо ітерацію для порожнього файлу
    }
    const ukJson = JSON.parse(ukJsonContent);
    const enJson = translateObject(ukJson);

    const outputFilename = basename(inputFullPath)
      .replace('план_укр', 'plan')
      .replace('маршрут_укр', 'route')
      .replace('_укр', '');

    const outputFullPath = join(outputDir, outputFilename);
    writeFileSync(outputFullPath, JSON.stringify(enJson, null, 2), 'utf-8');
    console.log(`✅ ${inputFileRelativePath} -> ${join('canonical', outputFilename)}`);
  } catch (error) {
    console.error(`❌ Помилка під час обробки файлу ${inputFileRelativePath}:`);
    console.error(error);
  }
});

console.log('--- Трансляцію завершено ---');