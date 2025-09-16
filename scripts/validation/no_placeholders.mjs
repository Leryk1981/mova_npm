import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { resolve, dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '../..');

const inputDirRelativePath = process.argv[2];

if (!inputDirRelativePath) {
  console.error('❌ Помилка: Вкажіть шлях до директорії з шаблонами.');
  process.exit(1);
}

const inputDirFullPath = resolve(root, inputDirRelativePath);

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

console.log(`--- Перевірка плейсхолдерів у ${inputDirRelativePath} ---`);

files.forEach(fullPath => {
  const filePath = relative(root, fullPath);
  const fileContent = readFileSync(fullPath, 'utf-8');

  if (fileContent.trim() === '') {
    console.warn(`⚠️  Файл ${filePath} порожній і буде проігнорований.`);
    return;
  }

  try {
    const content = JSON.parse(fileContent);
    const contentString = JSON.stringify(content);

    // Шукаємо плейсхолдери у форматі <...>
    const placeholderRegex = /<[^>]+>/g;
    const matches = contentString.match(placeholderRegex);

    if (matches) {
      console.error(`❌ Помилка в ${filePath}: знайдено плейсхолдери:`);
      matches.forEach(match => {
        console.error(`  - ${match}`);
      });
      hasErrors = true;
    }
  } catch (e) {
    console.error(`❌ Помилка парсингу JSON у файлі ${filePath}: ${e.message}`);
    hasErrors = true;
  }
});

if (hasErrors) {
  console.error('❌ Знайдено плейсхолдери або помилки парсингу.');
  process.exit(1);
}

console.log('✅ Усі файли пройшли перевірку на відсутність плейсхолдерів.');