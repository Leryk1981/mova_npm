import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// --- Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

const lexiconPath = resolve(projectRoot, 'lexicon_uk.json');
const lexicon = JSON.parse(readFileSync(lexiconPath, 'utf-8'));
const invertedLexicon = Object.fromEntries(Object.entries(lexicon).map(([uk, en]) => [en, uk]));

const schemaDir = resolve(projectRoot, 'schemas');
const mainSchemaPath = resolve(schemaDir, 'envelope.3.3.schema.json');

function loadSchema(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Schema file not found: ${filePath}`);
  }
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

function translateSchemaKeys(schema, allSchemas) {
  if (Array.isArray(schema)) {
    return schema.map(item => translateSchemaKeys(item, allSchemas));
  }

  if (schema && typeof schema === 'object') {
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
          const referencedSchema = allSchemas[refPath];
          if (referencedSchema) {
            // Embed and translate the referenced schema
            return translateSchemaKeys(referencedSchema, allSchemas);
          }
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
  const mainSchema = loadSchema(mainSchemaPath);
  const allSchemas = {
    'envelope.3.3.schema.json': mainSchema,
    // Load all action schemas
    ...Object.fromEntries(
      mainSchema.$defs.action.oneOf
        .map(ref => ref.$ref)
        .map(refPath => [refPath, loadSchema(resolve(schemaDir, refPath))])
    ),
  };

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