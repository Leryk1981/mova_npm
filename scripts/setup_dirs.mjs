import { mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

const dirsToCreate = [
  'scripts/build',
  'scripts/runtime',
  'scripts/translation',
  'scripts/validation',
  'build', // Ця директорія потрібна для артефакту canonical_keys.json
  'schemas/core',
  'schemas/definitions',
  'scripts/language',
  'templates/ua/plans',
  'templates/ua/routes',
  'templates/ua/from-en/plans',
  'templates/ua/from-en/routes',
  'templates/mappings'
];

console.log('--- Створення необхідних директорій ---');

dirsToCreate.forEach(dir => {
  const dirPath = resolve(projectRoot, dir);
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Створено директорію: ${dir}`);
  } else {
    console.log(`☑️  Директорія вже існує: ${dir}`);
  }
});

console.log('--- Завершено ---');