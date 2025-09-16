import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

const blankPath = process.argv[2];
const outputPath = process.argv[3];
const replacements = process.argv.slice(4);

if (!blankPath || !outputPath) {
  console.error('❌ Використання: node scaffold.mjs <blank_file> <output_file> [key1=value1] [key2=value2] ...');
  process.exit(1);
}

let blankFullPath;
if (blankPath.startsWith('/') || blankPath.startsWith('\\') || blankPath.includes(':\\')) {
  // Абсолютний шлях
  blankFullPath = blankPath;
} else {
  // Відносний шлях до root
  blankFullPath = resolve(root, blankPath);
}

if (!existsSync(blankFullPath)) {
  console.error(`❌ Помилка: Файл бланка не знайдено: ${blankFullPath}`);
  process.exit(1);
}

let outputFullPath;
if (outputPath.startsWith('/') || outputPath.startsWith('\\') || outputPath.includes(':\\')) {
  // Абсолютний шлях
  outputFullPath = outputPath;
} else {
  // Відносний шлях до root
  outputFullPath = resolve(root, outputPath);
}
const outputDir = dirname(outputFullPath);
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

// Парсимо заміни
const replaceMap = {};
replacements.forEach(arg => {
  const eqIndex = arg.indexOf('=');
  if (eqIndex > 0) {
    const key = arg.substring(0, eqIndex);
    const value = arg.substring(eqIndex + 1);
    replaceMap[key] = value;
  }
});

try {
  let content = readFileSync(blankFullPath, 'utf-8');

  // Замінюємо плейсхолдери <KEY> на значення
  for (const [key, value] of Object.entries(replaceMap)) {
    content = content.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  }

  console.log(`Після заміни, розмір content: ${content.length}`);
  console.log(`Content preview: ${content.substring(500, 600)}`);
  writeFileSync(outputFullPath, content, 'utf-8');
  console.log(`✅ Створено файл: ${outputPath}`);
  console.log(`Розмір файлу: ${content.length} символів`);

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