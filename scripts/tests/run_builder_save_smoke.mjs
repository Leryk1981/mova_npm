import http from 'node:http';
import path from 'node:path';
import fsPromises from 'node:fs/promises';

const PORT = Number(process.env.PORT || 3000);

function post(targetPath, payload) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(payload));
    const req = http.request(
      {
        host: '127.0.0.1',
        port: PORT,
        path: targetPath,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      },
      res => {
        let body = '';
        res.on('data', chunk => {
          body += chunk;
        });
        res.on('end', () => {
          let parsed = {};
          try { parsed = body ? JSON.parse(body) : {}; } catch {}
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function exists(filePath) {
  try {
    await fsPromises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const testId = 'smoke_builder_save';
  const targetDir = path.join(process.cwd(), 'templates', 'forms', testId);
  const targetFile = path.join(targetDir, 'template.form.json');
  const relativePath = path.posix.join('templates', 'forms', testId, 'template.form.json');

  await fsPromises.rm(targetDir, { recursive: true, force: true });

  const okPayload = {
    formSpec: {
      id: testId,
      baseCanonical: { mova_version: '3.3.0', $schema: 'envelope.schema.json', steps: [] },
      bind: {},
      form: {}
    }
  };

  const ok = await post('/api/builder/save', okPayload);
  const fileCreated = await exists(targetFile);
  console.log('save.ok.status', ok.status, 'ok', ok.body?.ok, 'fileCreated', fileCreated);

  const bad = await post('/api/builder/save', {
    formSpec: { id: 'bad id with spaces' }
  });
  console.log('save.bad.status', bad.status, 'error.code', bad.body?.error?.code);

  const success = ok.status === 200 && ok.body?.ok === true && ok.body?.id === testId && ok.body?.path === relativePath && fileCreated && bad.status === 422 && bad.body?.error?.code === 'FORMSPEC_INVALID';

  await fsPromises.rm(targetDir, { recursive: true, force: true });
  process.exit(success ? 0 : 1);
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});
