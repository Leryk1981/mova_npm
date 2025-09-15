import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
// Import the specific constructor for JSON Schema 2020-12
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

// --- Налаштування ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

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

// Спочатку створюємо екземпляр Ajv. Він має автоматично завантажити мета-схему 2020-12.
const ajv = new Ajv2020({ allErrors: true, validateSchema: false, discriminator: true });
// Потім додаємо всі наші схеми. Це також їх скомпілює.
ajv.addSchema(allSchemas);

addFormats(ajv);

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
      console.error(JSON.stringify(validate.errors, null, 2));
      hasErrors = true;
    }
  } catch (error) {
    console.error(`💥 Помилка під час читання або парсингу файлів для ${dataPath}:`);
    console.error(error);
    hasErrors = true;
  }
}

// --- Запуск валідації для всіх файлів ---
console.log('--- Початок валідації канонічних файлів ---');

const canonicalDir = resolve(projectRoot, 'canonical');

try {
  const canonicalFiles = readdirSync(canonicalDir).filter(f => f.endsWith('.json'));

  if (canonicalFiles.length === 0) {
    console.warn('⚠️  Не знайдено жодного .json файлу в директорії canonical для валідації.');
  }

  for (const fileName of canonicalFiles) {
    if (fileName === 'manifest.json') continue; // Ignore the manifest file

    let schemaName;
    // Проста логіка для визначення схеми за назвою файлу
    if (fileName.includes('route')) {
      schemaName = 'route.1.0.schema.json';
    } else if (fileName.includes('plan')) {
      schemaName = 'envelope.3.3.schema.json';
    }

    if (schemaName) {
      const dataPath = join('canonical', fileName);
      const schemaPath = join('schemas', schemaName);
      validateFile(dataPath, schemaPath);
    } else {
      console.warn(`⚠️  Не знайдено відповідної схеми для файлу: ${fileName}`);
    }
  }
} catch (error) {
  if (error.code === 'ENOENT') {
    console.warn(`⚠️  Директорія 'canonical' не існує, валідацію пропущено.`);
  } else {
    console.error('💥 Не вдалося прочитати директорію canonical:', error);
    hasErrors = true;
  }
}

console.log('\n--- Валідацію завершено ---');

if (hasErrors) {
  console.error('\n❗️ Знайдено помилки валідації.');
  process.exit(1);
} else {
  console.log('\n🎉 Усі канонічні файли успішно провалідовано!');
}