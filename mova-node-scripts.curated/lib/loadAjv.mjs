import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { listJsonFiles, readJSON } from './util.mjs';

export function loadValidators(schemasDir) {
  // Use the specialized Ajv constructor for JSON Schema 2020-12.
  // This is the recommended approach and avoids all the manual file loading issues.
  // It comes with the meta-schema pre-loaded.
  const ajv = new Ajv2020({
    strict: false,
    allErrors: true,
    allowUnionTypes: true,
  });
  addFormats(ajv);

  const files = listJsonFiles(schemasDir);
  const schemas = files.map(readJSON).filter(Boolean);

  // WORKAROUND: A schema with $id '.../actions/vnl.schema.json' has a relative
  // $ref of '../vnl.schema.json'. This resolves to an ID that doesn't exist
  // ('.../vnl.schema.json'). To fix this, we find the schema object on disk
  // and pre-emptively add it to ajv under the ID that it's looking for.
  const vnlActionSchemaId = 'https://mova.dev/schemas/actions/vnl.schema.json';
  const vnlActionSchemaObject = schemas.find(s => s?.$id === vnlActionSchemaId);
  if (vnlActionSchemaObject) {
    const missingId = 'https://mova.dev/schemas/vnl.schema.json';
    // Add the schema under the alias ID that ajv will look for.
    ajv.addSchema(vnlActionSchemaObject, missingId);
  }

  // Add all schemas individually, checking for existence before adding.
  // This prevents the "schema with key or id ... already exists" error that occurs
  // when the workaround adds a schema that is also present in the main `schemas` array.
  for (const schema of schemas) {
    if (schema?.$id && !ajv.getSchema(schema.$id)) {
      ajv.addSchema(schema);
    }
  }

  // Find the main schemas by their $id, which is more robust than relying on filenames.
  const envelopeSchema = schemas.find((s) => s?.$id && /envelope\.3\.3/i.test(s.$id));
  const routeSchema = schemas.find((s) => s?.$id && /route\.1\.0/i.test(s.$id));

  if (!envelopeSchema) {
    throw new Error(`Could not find a loaded schema with an $id matching /envelope\\.3\\.3/i in '${schemasDir}'`);
  }
  if (!routeSchema) {
    throw new Error(`Could not find a loaded schema with an $id matching /route\\.1\.0/i in '${schemasDir}'`);
  }

  const validatePlan = ajv.getSchema(envelopeSchema.$id);
  const validateRoute = ajv.getSchema(routeSchema.$id);

  if (!validatePlan) throw new Error(`Failed to compile/get Envelope 3.3 schema (id: ${envelopeSchema.$id})`);
  if (!validateRoute) throw new Error(`Failed to compile/get Route 1.0 schema (id: ${routeSchema.$id})`);

  return { validatePlan, validateRoute };
}
