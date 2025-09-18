import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv/dist/2020.js';

const [, , inDir = 'dist/canonical', , schemasDir = 'schemas'] = process.argv;
const ajv = new Ajv({ allErrors: true, strict: true });

function loadSchemas(dir) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  for (const f of files) {
    const sch = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    ajv.addSchema(sch);
  }
}
function validateDir(dir) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  let errors = 0;
  for (const f of files) {
    const doc = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    // Версійна брама: приймаємо лише 3.3.x
    const v = (doc?.mova_version || '').toString();
    if (!/^3\.3\.\d+/.test(v)) {
      console.error(`[version-gate] ${f}: only mova_version 3.3.x is accepted (found: ${v})`);
      errors++;
      continue;
    }
    // Пошук цільової схеми по $schema/$id або назвам файлів
    const $id = doc?.$schema || doc?.$id;
    let validate;
    if ($id && ajv.getSchema($id)) {
      validate = ajv.getSchema($id);
    } else {
      // Фолбек: шукаємо схему з таким самим іменем
      const name = path.basename(f);
      validate = ajv.getSchema(name);
    }
    if (!validate) {
      console.error(`[schema-miss] No schema found for ${f}`);
      errors++;
      continue;
    }
    const ok = validate(doc);
    if (!ok) {
      console.error(`[schema-fail] ${f}`, validate.errors);
      errors++;
    } else {
      console.log(`[ok] ${f}`);
    }
  }
  return errors;
}

try {
  if (!fs.existsSync(inDir)) {
    console.error(`[input-miss] ${inDir} not found`);
    process.exit(2);
  }
  loadSchemas(schemasDir);
  const errs = validateDir(inDir);
  process.exit(errs === 0 ? 0 : 1);
} catch (e) {
  console.error(e);
  process.exit(2);
}
