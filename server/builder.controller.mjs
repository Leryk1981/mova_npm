import Ajv from 'ajv/dist/2020.js';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import express from 'express';

const router = express.Router();

const ajv = new Ajv({ allErrors: true, strict: true, allowUnionTypes: true, discriminator: true, strictRequired: false });
ajv.addFormat('uri-template', true);

(function loadSchemas() {
  const root = path.join(process.cwd(), 'schemas');
  if (!fs.existsSync(root)) return;

  const added = new Set();
  const register = (schema, key) => {
    if (!key || added.has(key)) return;
    try {
      ajv.addSchema(schema, key);
      added.add(key);
    } catch {
      added.add(key);
    }
  };

  const stack = [{ dir: root, relative: '' }];
  while (stack.length) {
    const { dir, relative } = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        stack.push({
          dir: path.join(dir, entry.name),
          relative: relative ? `${relative}/${entry.name}` : entry.name
        });
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;

      const schemaPath = path.join(dir, entry.name);
      const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
      const relKey = relative ? `${relative}/${entry.name}` : entry.name;

      register(schema, relKey);
      register(schema, entry.name);
      if (schema.$id) register(schema, schema.$id);

      const aliasName = entry.name.replace(/\.[0-9]+\.[0-9]+\.schema\.json$/, '.schema.json');
      if (aliasName !== entry.name) {
        const aliasKey = relative ? `${relative}/${aliasName}` : aliasName;
        register(schema, aliasKey);
        register(schema, aliasName);
      }
    }
  }
})();

async function buildCanonicalFromForm(formSpec) {
  if (formSpec?.baseCanonical) return formSpec.baseCanonical;
  throw new Error('FORM_BUILD_NOT_IMPLEMENTED');
}

function send422(res, details, code = 'VALIDATION_FAILED', message = 'Envelope validation failed') {
  return res.status(422).json({
    error: {
      code,
      message,
      details
    }
  });
}

function validateEnvelope(envelope) {
  const id = envelope?.$schema || envelope?.$id;
  let validate = id ? ajv.getSchema(id) : null;
  if (!validate) {
    validate = ajv.getSchema('envelope.schema.json');
  }
  if (!validate) return { ok: false, errors: [{ message: 'Schema not found' }] };

  const v = String(envelope?.mova_version || '');
  if (!/^3\.3\.\d+$/.test(v)) {
    return { ok: false, errors: [{ message: `Only mova_version 3.3.x is accepted (found: ${v})`, keyword: 'version-gate' }] };
  }

  const ok = validate(envelope);
  return ok ? { ok: true } : { ok: false, errors: validate.errors || [] };
}

function safeReadJSON(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

router.get('/templates', (_req, res) => {
  const root = path.join(process.cwd(), 'templates', 'forms');
  if (!fs.existsSync(root)) return res.json([]);

  const ids = [];
  for (const dir of fs.readdirSync(root, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const templatePath = path.join(root, dir.name, 'template.form.json');
    if (!fs.existsSync(templatePath)) continue;

    const templateSpec = safeReadJSON(templatePath);
    if (templateSpec?.id) ids.push(templateSpec.id);
  }

  res.json(ids);
});

router.get('/catalog/actions', (_req, res) => {
  res.json([
    {
      type: 'template',
      name: 'render',
      with_schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          template_id: { type: 'string' },
          vars: { type: 'object' }
        },
        required: ['template_id']
      }
    },
    {
      type: 'emit_event',
      name: 'cloudevent',
      with_schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          event_type: { type: 'string' },
          data: { type: 'object' }
        },
        required: ['event_type']
      }
    },
    {
      type: 'assert',
      name: 'equals',
      with_schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          left: {},
          right: {}
        },
        required: ['left', 'right']
      }
    }
  ]);
});

router.post('/preview', async (req, res) => {
  try {
    const body = req.body || {};
    let envelope;

    if (body.formSpec) {
      const canon = await buildCanonicalFromForm(body.formSpec);
      envelope = canon;
    } else if (body.envelope) {
      envelope = body.envelope;
    } else {
      return send422(res, [{ message: 'Either formSpec or envelope is required' }]);
    }

    let normalized = envelope;
    let insertedActions = false;
    if (normalized && typeof normalized === 'object') {
      normalized = { ...normalized };
      if (!('actions' in normalized) && Array.isArray(normalized.steps)) {
        normalized.actions = normalized.steps;
        insertedActions = true;
      }
    }

    const result = validateEnvelope(normalized);
    const allowEmptyActions = insertedActions && Array.isArray(normalized?.actions) && normalized.actions.length === 0 && Array.isArray(result.errors) && result.errors.every(err => err.keyword === 'minItems' && err.instancePath === '/actions');

    if (!result.ok && !allowEmptyActions) {
      return send422(res, result.errors);
    }

    return res.json({ ok: true, envelope: normalized });
  } catch (e) {
    return res.status(500).json({
      error: { code: 'PREVIEW_INTERNAL_ERROR', message: String(e?.message || e) }
    });
  }
});

router.post('/save', async (req, res) => {
  const formSpec = req.body?.formSpec;
  if (!formSpec || typeof formSpec !== 'object' || Array.isArray(formSpec)) {
    return send422(res, [{ message: 'formSpec must be an object' }], 'FORMSPEC_INVALID', 'FormSpec validation failed');
  }

  const id = formSpec.id;
  if (typeof id !== 'string' || id.trim() === '') {
    return send422(res, [{ message: 'formSpec.id must be a non-empty string' }], 'FORMSPEC_INVALID', 'FormSpec validation failed');
  }

  if (!/^[a-z0-9._:-]+$/.test(id)) {
    return send422(res, [{ message: 'formSpec.id must match ^[a-z0-9._:-]+$' }], 'FORMSPEC_INVALID', 'FormSpec validation failed');
  }

  const targetDir = path.join(process.cwd(), 'templates', 'forms', id);
  const filePath = path.join(targetDir, 'template.form.json');
  const relativePath = path.posix.join('templates', 'forms', id, 'template.form.json');

  try {
    await fsPromises.mkdir(targetDir, { recursive: true });
    await fsPromises.writeFile(filePath, JSON.stringify(formSpec, null, 2) + '\n', 'utf8');
  } catch (error) {
    console.error('Failed to save formSpec', error);
    return res.status(500).json({
      error: { code: 'SAVE_FAILED', message: 'Failed to save formSpec' }
    });
  }

  return res.json({ ok: true, id, path: relativePath });
});

export default router;
