import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

// --- Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

const lexiconPath = resolve(projectRoot, 'lexicon_uk.json');
const lexicon = JSON.parse(readFileSync(lexiconPath, 'utf-8'));
const invertedLexicon = Object.fromEntries(Object.entries(lexicon).map(([uk, en]) => [en, uk]));

const schemaDir = resolve(projectRoot, 'schemas');
const mainSchemaId = 'https://mova.dev/schemas/core/envelope.3.3.schema.json';

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

const allSchemas = {};
const schemaFilePaths = findJsonFiles(schemaDir);
for (const schemaPath of schemaFilePaths) {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
    if (schema.$id) {
        allSchemas[schema.$id] = schema;
    }
}

function translateSchemaKeys(schema, allSchemas) {
  if (Array.isArray(schema)) {
    return schema.map(item => translateSchemaKeys(item, allSchemas));
  }

  if (schema && typeof schema === 'object') {
    // Handle $ref first
    if (schema.$ref) {
        const refId = schema.$ref.split('#')[0];
        if (allSchemas[refId]) {
            // If it's a reference to a whole other schema, embed and translate it.
            return translateSchemaKeys(allSchemas[refId], allSchemas);
        }
    }

    const newSchema = {};
    for (const key in schema) {
      const translatedKey = invertedLexicon[key] || key;

      if (key === '$ref') {
        // Resolve the reference and embed it directly, then translate its contents.
        const refPath = schema[key];
        if (refPath.startsWith('#/')) {
          // Internal reference, handle later if needed, for now just copy
          newSchema[translatedKey] = refPath;
        } else {
          // It's an external schema ref, we just copy it.
          newSchema[translatedKey] = refPath;
        }
      } else if (key === 'properties' && typeof schema[key] === 'object') {
        newSchema[translatedKey] = translateSchemaKeys(schema[key], allSchemas);
      } else if (key === 'required' && Array.isArray(schema[key])) {
        newSchema[translatedKey] = schema[key].map(reqKey => invertedLexicon[reqKey] || reqKey);
      } else if (key === 'const' && typeof schema[key] === 'string') {
        newSchema[translatedKey] = invertedLexicon[schema[key]] || schema[key];
      } else if (key === 'discriminator' && typeof schema[key] === 'object') {
        const disc = schema[key];
        newSchema[translatedKey] = {
          ...disc,
          propertyName: invertedLexicon[disc.propertyName] || disc.propertyName,
        };
      } else {
        newSchema[translatedKey] = translateSchemaKeys(schema[key], allSchemas);
      }
    }
    return newSchema;
  }

  return schema;
}

console.log('--- Початок генерації української схеми ---');

try {
  const mainSchema = allSchemas[mainSchemaId];
  const ukranianSchema = translateSchemaKeys(mainSchema, allSchemas);

  const outputDir = resolve(projectRoot, 'schemas/dist');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  const outputPath = resolve(outputDir, 'uk_plan_schema.json');
  writeFileSync(outputPath, JSON.stringify(ukranianSchema, null, 2), 'utf-8');

  console.log(`✅ Українську схему успішно згенеровано: ${outputPath}`);
} catch (error) {
  console.error('💥 Сталася помилка під час генерації української схеми:', error);
  process.exit(1);
}