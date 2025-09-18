import fs from 'node:fs';
import path from 'node:path';
import express from 'express';

const router = express.Router();

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

export default router;
