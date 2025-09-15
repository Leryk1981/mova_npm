import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname, join, relative } from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// --- Налаштування ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../..');

// --- Допоміжні функції ---

// Рекурсивно знаходить усі JSON-файли в директорії.
function findJsonFiles(dir) {
  let results = [];
  if (!existsSync(dir)) return results;

  const list = readdirSync(dir, { withFileTypes: true });
  for (const file of list) {
    const fullPath = resolve(dir, file.name);
    if (file.isDirectory()) {
      // Обробляємо лише папки, що містять схеми
      if (['core', 'definitions', 'actions'].includes(file.name)) {
        results = results.concat(findJsonFiles(fullPath));
      }
    } else if (file.name.endsWith('.json')) {
      results.push(fullPath);
    }
  }
  return results;
}

// Рекурсивно сортує ключі об'єкта для канонічного представлення.
function sortKeys(x) {
  if (Array.isArray(x)) return x.map(sortKeys);
  if (x && typeof x === 'object') {
    return Object.fromEntries(
      Object.keys(x)
        .sort()
        .map(k => [k, sortKeys(x[k])])
    );
  }
  return x;
}

// Створює канонічний (відсортовані ключі) JSON-рядок з об'єкта.
function canonicalJSON(obj) {
  return JSON.stringify(sortKeys(obj));
}

// --- Основна логіка ---
function createSchemaFingerprint({ schemasDir, out }) {
  const files = findJsonFiles(schemasDir);
  const entries = [];

  for (const p of files) {
    const j = JSON.parse(readFileSync(p, 'utf-8'));
    // Додаємо до відбитку лише файли, що є схемами (мають $id)
    if (!j.$id) continue;

    const canon = canonicalJSON(j);
    const hash = crypto.createHash('sha256').update(Buffer.from(canon)).digest('hex');
    // Зберігаємо відносний шлях у unix-форматі для консистентності
    entries.push({ file: relative(projectRoot, p).replace(/\\/g, '/'), sha256: hash });
  }

  entries.sort((a, b) => a.file.localeCompare(b.file));

  const payload = {
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    entries,
  };

  if (out) {
    writeFileSync(out, JSON.stringify(payload, null, 2));
    console.log(`✅ Згенеровано відбиток схем: ${relative(projectRoot, out)}`);
  } else {
    // Якщо вихідний файл не вказано, просто виводимо в консоль
    console.log(JSON.stringify(payload, null, 2));
  }
}

// --- Точка входу ---
const schemasDir = resolve(projectRoot, 'schemas');
const outFile = resolve(projectRoot, 'build/schema_fingerprint.json');

createSchemaFingerprint({ schemasDir: schemasDir, out: outFile });