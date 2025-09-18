import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
// Використовуємо спільну фабрику Ajv для JSON Schema 2020-12
import { createAjv } from '../lib/createAjv.mjs';
import { normalizeAjvErrors, validationError } from '../error_wrap.mjs';

// --- Налаштування ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../..');

let inputPathArg;

for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (!inputPathArg) {
    inputPathArg = arg;
  }
}

// --- Рекурсивний пошук файлів схем ---
function findJsonFiles(dir) {
  let results = [];
  if (!existsSync(dir)) return results;

  const list = readdirSync(dir, { withFileTypes: true });
  for (const file of list) {
    const fullPath = resolve(dir, file.name);
    if (file.isDirectory()) {
      results = results.concat(findJsonFiles(fullPath));
    } else if (file.name.endsWith('.json')) {
      results.push(fullPath);
    }
  }
  return results;
}

// --- Попереднє завантаження та компіляція всіх схем ---
const schemaDir = resolve(projectRoot, 'schemas');
const schemaFilePaths = findJsonFiles(schemaDir);
const allSchemas = [];

for (const schemaPath of schemaFilePaths) {
  const fileContent = readFileSync(schemaPath, 'utf-8');

  if (fileContent.trim() === '') {
    console.warn(`⚠️  Попередження: Файл порожній, ігнорується: ${schemaPath}`);
    continue;
  }

  try {
    const schema = JSON.parse(fileContent);
    // Обробляємо файл, тільки якщо він оголошує себе як JSON Schema
    if (schema.$schema) {
      if (!schema.$id) {
        console.error(`❌ Помилка: Файл схеми "${schemaPath}" не має обов'язкового поля "$id".`);
        process.exit(1);
      }
      allSchemas.push(schema);
    }
  } catch (e) {
    console.error(`❌ Помилка парсингу JSON у файлі: ${schemaPath}`);
    throw e; // Повторно кидаємо помилку, щоб побачити повний контекст
  }
}

// Створюємо екземпляр Ajv через спільну фабрику (draft 2020-12).
const ajv = createAjv({ validateSchema: false, strict: false, allowUnionTypes: true, strictRequired: false });
// Потім додаємо всі наші схеми. Це також їх скомпілює.
ajv.addSchema(allSchemas);

let hasErrors = false;

// --- Функція для валідації ---
function validateFile(dataPath, schemaPath) {
  const dataFullPath = resolve(projectRoot, dataPath);
  const schemaFullPath = resolve(projectRoot, schemaPath);

  console.log(`\n🔎 Валідація файлу: ${dataPath}`);

  try {
    const schema = JSON.parse(readFileSync(schemaFullPath, 'utf-8'));
    const data = JSON.parse(readFileSync(dataFullPath, 'utf-8'));

    // Отримуємо вже скомпільований валідатор за його унікальним $id
    const validate = ajv.getSchema(schema.$id);
    if (!validate) {
      throw new Error(`Не вдалося знайти попередньо скомпільовану схему з $id: ${schema.$id}`);
    }
    const valid = validate(data);

    if (valid) {
      console.log(`✅ ${dataPath} відповідає схемі ${schemaPath}.`);
    } else {
      console.error(`❌ ${dataPath} НЕ відповідає схемі ${schemaPath}:`);
      const wrapped = validationError('Validation failed', normalizeAjvErrors(validate.errors));
      console.error(JSON.stringify(wrapped.body, null, 2));
      hasErrors = true;
    }
  } catch (error) {
    console.error(`💥 Помилка під час читання або парсингу файлів для ${dataPath}:`);
    console.error(error);
    hasErrors = true;
  }
}

// --- Запуск валідації ---
console.log('--- Початок валідації ---');

if (inputPathArg) {
  // Валідація одного файлу
  const dataPath = inputPathArg;
  const schemaPath = 'schemas/core/envelope.3.3.schema.json'; // За замовчуванням envelope схема
  validateFile(dataPath, schemaPath);
} else {
  // Валідація всіх файлів у канонічних директоріях
  const canonicalDirs = [
    { label: 'canonical', dir: resolve(projectRoot, 'canonical') },
    { label: 'templates/canonical', dir: resolve(projectRoot, 'templates/canonical') }
  ];

  let validatedFiles = 0;

  for (const { label, dir } of canonicalDirs) {
    try {
      const files = readdirSync(dir).filter(f => f.endsWith('.json'));

      if (files.length === 0) {
        console.warn(`⚠️  Не знайдено жодного .json файлу в директорії ${label} для валідації.`);
        continue;
      }

      for (const fileName of files) {
        if (fileName === 'manifest.json') continue; // Ignore the manifest file

        let schemaName;
        if (fileName.includes('route') || fileName.includes('маршрут')) {
          schemaName = 'core/route.1.0.schema.json';
        } else {
          // По умолчанию используем envelope схему для всех остальных файлов
          schemaName = 'core/envelope.3.3.schema.json';
        }

        if (schemaName) {
          const dataPath = join(label, fileName);
          const schemaPath = join('schemas', schemaName);
          validateFile(dataPath, schemaPath);
          validatedFiles += 1;
        } else {
          console.warn(`⚠️  Не знайдено відповідної схеми для файлу: ${fileName}`);
        }
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.warn(`⚠️  Директорія '${label}' не існує, валідацію пропущено.`);
      } else {
        console.error(`💥 Не вдалося прочитати директорію ${label}:`, error);
        hasErrors = true;
      }
    }
  }

  if (validatedFiles === 0) {
    console.warn('⚠️  Не знайдено канонічних файлів для валідації.');
  }
}
console.log('\n--- Валідацію завершено ---');

if (hasErrors) {
  console.error('\n❗️ Знайдено помилки валідації.');
  process.exit(1);
} else {
  console.log('\n🎉 Усі канонічні файли успішно провалідовано!');
}



