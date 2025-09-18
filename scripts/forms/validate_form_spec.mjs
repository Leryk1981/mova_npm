import fs from 'fs';
import path from 'path';
import { createAjv } from '../lib/createAjv.mjs';
import { normalizeAjvErrors, validationError } from '../error_wrap.mjs';

const ajv = createAjv();

const schemaPath = path.resolve('schemas/form_spec.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
let validate;
try {
  validate = ajv.compile(schema);
} catch (error) {
  const wrapped = validationError('Validation failed', normalizeAjvErrors(error?.errors || [error]));
  console.error(JSON.stringify(wrapped.body, null, 2));
  process.exit(1);
}

function emitValidationError(filePath, errors) {
  const wrapped = validationError('Validation failed', normalizeAjvErrors(errors));
  console.error(`Validation failed for ${filePath}:`);
  console.error(JSON.stringify(wrapped.body, null, 2));
}

function validateFormSpec(filePath) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const valid = validate(data);
    if (!valid) {
      emitValidationError(filePath, validate.errors);
      return false;
    }
    console.log(`? ${filePath} is valid`);
    return true;
  } catch (err) {
    console.error(`Error reading or parsing ${filePath}:`, err.message);
    return false;
  }
}

function validateDirectory(dirPath) {
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.form.json'));
  let allValid = true;
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    if (!validateFormSpec(filePath)) {
      allValid = false;
    }
  }
  return allValid;
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/forms/validate_form_spec.mjs <path/to/dir/or/file>');
  process.exit(1);
}

const stat = fs.statSync(inputPath);
let success;
if (stat.isDirectory()) {
  success = validateDirectory(inputPath);
} else {
  success = validateFormSpec(inputPath);
}

if (!success) {
  process.exit(1);
}
