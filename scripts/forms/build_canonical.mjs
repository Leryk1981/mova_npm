import fs from 'fs';
import path from 'path';

function emailsToArray(input) {
  if (input === undefined || input === null) {
    return [];
  }
  if (Array.isArray(input)) {
    return input
      .map(entry => {
        if (typeof entry === 'string') {
          const trimmed = entry.trim();
          return trimmed ? { email: trimmed } : null;
        }
        if (entry && typeof entry === 'object' && typeof entry.email === 'string') {
          return { email: entry.email.trim() };
        }
        return null;
      })
      .filter(Boolean);
  }
  if (typeof input !== 'string') {
    throw new Error(`emailsToArray transform expects string or array, received ${typeof input}`);
  }
  return input
    .split(',')
    .map(email => email.trim())
    .filter(Boolean)
    .map(email => ({ email }));
}

function bearerFromAlias(alias, args = {}) {
  if (typeof alias !== 'string' || alias.trim().length === 0) {
    throw new Error('bearerFromAlias transform requires a non-empty secret alias');
  }
  const mode = args.as === 'raw' ? 'raw' : 'bearer';
  const secret = alias.trim();
  return { $secret: secret, as: mode };
}

function int(value) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = typeof value === 'number' ? value : parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`int transform could not parse value: ${value}`);
  }
  return parsed;
}

function float(value) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = typeof value === 'number' ? value : parseFloat(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`float transform could not parse value: ${value}`);
  }
  return parsed;
}

function json(value) {
  if (value === undefined || value === null || value === '') {
    return {};
  }
  if (typeof value === 'object') {
    return value;
  }
  if (typeof value !== 'string') {
    throw new Error(`json transform expects string input, received ${typeof value}`);
  }
  return JSON.parse(value);
}

const transforms = { emailsToArray, bearerFromAlias, int, float, json };

function applyTransform(value, transformName, transformArgs) {
  const transform = transforms[transformName];
  if (!transform) {
    throw new Error(`Unknown transform: ${transformName}`);
  }
  return transform(value, transformArgs ?? {});
}

function setValueByPointer(target, pointer, value) {
  const parts = pointer.split('/').slice(1);
  if (parts.length === 0) {
    throw new Error('JSON Pointer must not reference the whole document');
  }
  let current = target;
  for (let index = 0; index < parts.length - 1; index++) {
    const key = decodePointerSegment(parts[index]);
    const nextKey = decodePointerSegment(parts[index + 1]);
    if (!(key in current) || current[key] === undefined || current[key] === null) {
      const shouldBeArray = isFiniteIndex(nextKey);
      current[key] = shouldBeArray ? [] : {};
    }
    current = current[key];
  }
  const lastKey = decodePointerSegment(parts[parts.length - 1]);
  if (Array.isArray(current) && isFiniteIndex(lastKey)) {
    current[Number(lastKey)] = value;
  } else {
    current[lastKey] = value;
  }
}

function decodePointerSegment(segment) {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function isFiniteIndex(segment) {
  if (segment === '-') {
    return false;
  }
  const n = Number(segment);
  return Number.isInteger(n) && n >= 0;
}

function isMissing(value) {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === 'string' && value.trim().length === 0) {
    return true;
  }
  return false;
}

function collectFields(formSpec) {
  const map = new Map();
  for (const section of formSpec.sections || []) {
    for (const field of section.fields || []) {
      map.set(field.key, field);
    }
  }
  return map;
}
function buildCanonical(formSpec, formValues, options) {
  const canonical = JSON.parse(JSON.stringify(formSpec.baseCanonical));
  const fields = collectFields(formSpec);
  const totalBinds = Array.isArray(formSpec.bind) ? formSpec.bind.length : 0;

  const stats = {
    totalBinds,
    bindsApplied: 0,
    transformsApplied: 0,
    defaultsFilled: [],
    samplesFilled: []
  };
  const warnings = [];
  const errors = [];

  for (const binding of formSpec.bind) {
    const { from, to, transform, transformArgs } = binding;
    const field = fields.get(from);
    const defaultSeverity = field && field.required ? 'error' : 'warn';
    const severity = binding.severity || defaultSeverity;

    let value = formValues[from];
    let missing = isMissing(value);

    if (missing && field) {
      if ('default' in field) {
        value = field.default;
        missing = isMissing(value);
        stats.defaultsFilled.push(field.key);
      }
      if (missing && field.sample !== undefined && (options.fillSample || (options.mode === 'dev' && field.required))) {
        value = field.sample;
        missing = isMissing(value);
        stats.samplesFilled.push(field.key);
      }
    }

    if (missing) {
      const message = `Missing value for field ${from} -> ${to} (severity=${severity})`;
      if (options.mode === 'prod' && severity === 'error') {
        errors.push(message);
        continue;
      }
      warnings.push(message);
      continue;
    }

    let finalValue = value;
    if (transform) {
      try {
        finalValue = applyTransform(value, transform, transformArgs);
        stats.transformsApplied += 1;
      } catch (transformError) {
        errors.push(`Transform ${transform} failed for ${from}: ${transformError.message}`);
        continue;
      }
    }

    try {
      setValueByPointer(canonical, to, finalValue);
      stats.bindsApplied += 1;
    } catch (pointerError) {
      errors.push(`Failed to set pointer ${to} for ${from}: ${pointerError.message}`);
    }
  }

  return { canonical, stats, warnings, errors };
}

function findFormFiles(startDir) {
  const results = [];
  const entries = fs.readdirSync(startDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(startDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFormFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.form.json')) {
      results.push(fullPath);
    }
  }
  return results;
}

function parseCliArgs(argv) {
  const args = argv.slice(2);  const options = {
    mode: process.env.NODE_ENV === 'prod' ? 'prod' : 'dev',
    fillSample: false,
    inputPath: undefined,
    valuesPath: undefined,
    outDir: 'templates/canonical'
  };

  for (let idx = 0; idx < args.length; idx++) {
    const arg = args[idx];
    if (arg.startsWith('--mode=')) {
      options.mode = arg.split('=')[1];
    } else if (arg === '--mode' && idx + 1 < args.length) {
      options.mode = args[++idx];
    } else if (arg === '--fill-sample') {
      options.fillSample = true;
    } else if (arg.startsWith('--values=')) {
      options.valuesPath = arg.split('=')[1];
    } else if (arg === '--values' && idx + 1 < args.length) {
      options.valuesPath = args[++idx];
    } else if (arg.startsWith('--out-dir=')) {
      options.outDir = arg.split('=')[1];
    } else if (arg === '--out-dir' && idx + 1 < args.length) {
      options.outDir = args[++idx];
    } else if (arg.startsWith('--out=')) {
      options.outDir = arg.split('=')[1];
    } else if (arg === '--out' && idx + 1 < args.length) {
      options.outDir = args[++idx];
    } else if (!options.inputPath) {
      options.inputPath = arg;
    } else if (!options.valuesPath) {
      options.valuesPath = arg;
    }
  }

  if (!options.inputPath) {
    console.error('Usage: node scripts/forms/build_canonical.mjs <path/to/forms> [--values path] [--mode dev|prod] [--fill-sample] [--out-dir path]');
    process.exit(1);
  }

  if (options.mode !== 'prod') {
    options.mode = 'dev';
  }

  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadFormValues(formPath, overrideValuesPath) {
  if (overrideValuesPath) {
    if (!fs.existsSync(overrideValuesPath)) {
      console.warn(`Values file ${overrideValuesPath} not found. Falling back to smoke.values.json if available.`);
    } else {
      return readJson(overrideValuesPath);
    }
  }
  const autoValuesPath = path.join(path.dirname(formPath), 'smoke.values.json');
  if (fs.existsSync(autoValuesPath)) {
    return readJson(autoValuesPath);
  }
  return {};
}

function writeCanonical(formId, canonical, outDir) {
  const targetDir = outDir || path.join('templates', 'canonical');
  const outputPath = path.join(targetDir, `${formId}.canonical.json`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(canonical, null, 2));
  return outputPath;
}

function logBuildResult(formId, result, options) {
  const { stats, warnings, errors } = result;
  const coverage = stats.totalBinds === 0 ? 100 : Math.round((stats.bindsApplied / stats.totalBinds) * 1000) / 10;
  console.log(`Built canonical for ${formId} [mode=${options.mode}${options.fillSample ? ', fill-sample' : ''}]:`);
  console.log(`- Binds applied: ${stats.bindsApplied}/${stats.totalBinds}`);
  console.log(`- Transforms applied: ${stats.transformsApplied}`);
  console.log(`- Pointer coverage: ${stats.bindsApplied}/${stats.totalBinds} (${coverage}%)`);
  if (stats.defaultsFilled.length) {
    console.log(`- Defaults auto-filled: ${[...new Set(stats.defaultsFilled)].join(', ')}`);
  }
  if (stats.samplesFilled.length) {
    const label = options.fillSample ? 'Samples filled (fill-sample)' : 'Samples auto-filled';
    console.log(`- ${label}: ${[...new Set(stats.samplesFilled)].join(', ')}`);
  }
  if (warnings.length) {
    console.warn('Warnings:');
    for (const warning of warnings) {
      console.warn(`  - ${warning}`);
    }
  }
  if (errors.length) {
    console.error('Errors:');
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
  }
}

function processForm(formPath, options) {
  const formSpec = readJson(formPath);
  const formValues = loadFormValues(formPath, options.valuesPath);
  const result = buildCanonical(formSpec, formValues, options);

  logBuildResult(formSpec.id, result, options);

  if (result.errors.length === 0) {
    const outputPath = writeCanonical(formSpec.id, result.canonical, options.outDir);
    console.log(`- Output: ${outputPath}`);
    return { success: true, warnings: result.warnings.length }; 
  }

  return { success: false, warnings: result.warnings.length, errors: result.errors.length };
}

function processPath(options) {
  const stat = fs.statSync(options.inputPath);
  let overallSuccess = true;
  let totalWarnings = 0;
  let totalErrors = 0;

  if (stat.isDirectory()) {
    const formFiles = findFormFiles(options.inputPath);
    for (const file of formFiles) {
      const outcome = processForm(file, options);
      totalWarnings += outcome.warnings;
      if (!outcome.success) {
        overallSuccess = false;
        totalErrors += outcome.errors || 1;
      }
    }
  } else {
    const outcome = processForm(options.inputPath, options);
    totalWarnings += outcome.warnings;
    if (!outcome.success) {
      overallSuccess = false;
      totalErrors += outcome.errors || 1;
    }
  }

  if (!overallSuccess) {
    console.error(`build_canonical failed with ${totalErrors} error(s).`);
    process.exit(1);
  }

  if (options.mode === 'prod' && totalWarnings > 0) {
    console.error('Prod mode does not allow warnings.');
    process.exit(1);
  }
}

const options = parseCliArgs(process.argv);
processPath(options);





















