import fs from 'fs';
import path from 'path';

function parseCliArgs(argv) {
  const args = argv.slice(2);
  const options = {
    inputPath: undefined,
    mode: process.env.NODE_ENV === 'prod' ? 'prod' : 'dev'
  };

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg.startsWith('--mode=')) {
      options.mode = arg.split('=')[1];
    } else if (arg === '--mode' && index + 1 < args.length) {
      options.mode = args[++index];
    } else if (!options.inputPath) {
      options.inputPath = arg;
    }
  }

  if (!options.inputPath) {
    console.error('Usage: node scripts/forms/lint_bindings.mjs <path/to/dir/or/file> [--mode dev|prod]');
    process.exit(1);
  }

  if (options.mode !== 'prod') {
    options.mode = 'dev';
  }

  return options;
}

function readForm(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function collectFields(formSpec) {
  const fields = new Map();
  for (const section of formSpec.sections || []) {
    for (const field of section.fields || []) {
      fields.set(field.key, field);
    }
  }
  return fields;
}

function decodePointerSegment(segment) {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function isFiniteIndex(segment) {
  if (segment === '-') {
    return false;
  }
  const parsed = Number(segment);
  return Number.isInteger(parsed) && parsed >= 0;
}

function validatePointer(baseCanonical, pointer) {
  if (typeof pointer !== 'string' || !pointer.startsWith('/')) {
    throw new Error('JSON Pointer must start with /');
  }
  const parts = pointer.split('/').slice(1);
  if (parts.length === 0) {
    throw new Error('JSON Pointer must reference a nested value');
  }
  const working = JSON.parse(JSON.stringify(baseCanonical));
  let current = working;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = decodePointerSegment(parts[i]);
    const nextKey = decodePointerSegment(parts[i + 1]);
    if (!(key in current) || current[key] === undefined || current[key] === null) {
      current[key] = isFiniteIndex(nextKey) ? [] : {};
    }
    current = current[key];
    if (typeof current !== 'object') {
      throw new Error(`Pointer traverses non-object segment at ${parts[i]}`);
    }
  }
  const last = decodePointerSegment(parts[parts.length - 1]);
  if (Array.isArray(current) && !isFiniteIndex(last)) {
    throw new Error(`Pointer index ${last} is not a valid numeric index`);
  }
}

function lintBindings(filePath, options) {
  let ok = true;
  try {
    const formSpec = readForm(filePath);
    const fields = collectFields(formSpec);
    const { baseCanonical, bind } = formSpec;
    if (!Array.isArray(bind)) {
      console.error(`No bind array found in ${filePath}`);
      return false;
    }
    for (const binding of bind) {
      const field = fields.get(binding.from);
      if (!field) {
        console.error(`✗ ${filePath}: bind.from "${binding.from}" is not defined in sections.fields.`);
        ok = false;
        continue;
      }
      try {
        validatePointer(baseCanonical, binding.to);
      } catch (err) {
        console.error(`✗ ${filePath}: invalid JSON Pointer "${binding.to}" - ${err.message}`);
        ok = false;
      }
      if (options.mode === 'prod') {
        const severity = binding.severity || (field.required ? 'error' : 'warn');
        const hasDefault = Object.prototype.hasOwnProperty.call(field, 'default');
        const hasSample = Object.prototype.hasOwnProperty.call(field, 'sample');
        if (severity === 'error' && field.required && !hasDefault && !hasSample) {
          console.error(`✗ ${filePath}: required field "${field.key}" with severity=error must provide default or sample for prod builds.`);
          ok = false;
        }
      }
    }
    if (ok) {
      console.log(`✓ Bindings in ${filePath} are valid`);
    }
  } catch (err) {
    console.error(`Error reading or parsing ${filePath}: ${err.message}`);
    return false;
  }
  return ok;
}

function findFormFiles(dirPath) {
  const results = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFormFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.form.json')) {
      results.push(fullPath);
    }
  }
  return results;
}

function lintPath(options) {
  const stat = fs.statSync(options.inputPath);
  let success = true;
  if (stat.isDirectory()) {
    const files = findFormFiles(options.inputPath);
    for (const file of files) {
      if (!lintBindings(file, options)) {
        success = false;
      }
    }
  } else {
    success = lintBindings(options.inputPath, options);
  }
  if (!success) {
    process.exit(1);
  }
}

const options = parseCliArgs(process.argv);
lintPath(options);
