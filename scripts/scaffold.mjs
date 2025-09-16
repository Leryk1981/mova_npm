import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '../..');

const blankPath = process.argv[2];
const outputPath = process.argv[3];
const replacements = process.argv.slice(4);

if (!blankPath || !outputPath) {
  console.error('❌ Використання: node scaffold.mjs <blank_file> <output_file> [key1=value1] [key2=value2] ...');
  process.exit(1);
}

const blankFullPath = resolve(root, blankPath);
if (!existsSync(blankFullPath)) {
  console.error(`❌ Помилка: Файл бланка не знайдено: ${blankFullPath}`);
  process.exit(1);
}

const outputFullPath = resolve(root, outputPath);
const outputDir = dirname(outputFullPath);
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

// Парсимо заміни
const replaceMap = {};
replacements.forEach(arg => {
  const [key, ...valueParts] = arg.split('=');
  if (key && valueParts.length > 0) {
    replaceMap[key] = valueParts.join('=');
  }
});

try {
  let content = readFileSync(blankFullPath, 'utf-8');

  // Замінюємо плейсхолдери <KEY> на значення
  for (const [key, value] of Object.entries(replaceMap)) {
    const placeholder = `<${key}>`;
    content = content.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  }

  writeFileSync(outputFullPath, content, 'utf-8');
  console.log(`✅ Створено файл: ${outputPath}`);

  // Перевіряємо, чи залишились плейсхолдери
  const remainingPlaceholders = content.match(/<[^>]+>/g);
  if (remainingPlaceholders) {
    console.warn(`⚠️  Увага: залишились плейсхолдери:`);
    remainingPlaceholders.forEach(ph => console.warn(`  - ${ph}`));
  }
} catch (error) {
  console.error(`❌ Помилка під час обробки: ${error.message}`);
  process.exit(1);
}