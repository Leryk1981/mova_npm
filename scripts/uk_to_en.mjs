import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { resolve, dirname, basename, join } from 'path';
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

// 3. Рекурсивна функція для трансляції ключів
function translateKeys(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => translateKeys(item));
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const translatedKey = lexicon[key] || key;
      acc[translatedKey] = translateKeys(obj[key]);
      return acc;
    }, {});
  }
  return obj;
}

// 4. Створюємо директорію для канонічних файлів
const outputDir = resolve(projectRoot, 'canonical');
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
  console.log(`Створено директорію: ${outputDir}`);
}

// 5. Читаємо та обробляємо всі файли з директорії
const files = readdirSync(inputDirFullPath);
const jsonFiles = files.filter(file => file.endsWith('.json'));

if (jsonFiles.length === 0) {
  console.warn(`⚠️  Не знайдено жодного .json файлу в директорії ${inputDirRelativePath}`);
  process.exit(0);
}

console.log(`--- Початок трансляції файлів з ${inputDirRelativePath} ---`);

jsonFiles.forEach(fileName => {
  const inputFileRelativePath = join(inputDirRelativePath, fileName);
  const inputFullPath = resolve(projectRoot, inputFileRelativePath);

  try {
    const ukJsonContent = readFileSync(inputFullPath, 'utf-8');
    const ukJson = JSON.parse(ukJsonContent);
    const enJson = translateKeys(ukJson);

    const outputFilename = basename(inputFileRelativePath)
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