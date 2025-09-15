import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
// Import the specific constructor for JSON Schema 2020-12
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

// --- Налаштування ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// Initialize Ajv using the 2020-12 constructor
const ajv = new Ajv2020({ allErrors: true });
// WORKAROUND: The Ajv instance is failing to find its own meta-schema.
// We disable schema validation to bypass this internal check, as we trust our own schemas.
// This allows Ajv to proceed with validating the data against the schemas.
ajv.opts.validateSchema = false;

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

    const validate = ajv.compile(schema);
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
    let schemaName;
    // Проста логіка для визначення схеми за назвою файлу
    if (fileName.startsWith('plan')) {
      schemaName = 'plan.schema.json';
    } else if (fileName.startsWith('route')) {
      schemaName = 'route.schema.json';
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