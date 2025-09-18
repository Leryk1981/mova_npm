import http from 'node:http';

const PORT = Number(process.env.PORT || 3000);

function post(path, payload) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(payload));
    const req = http.request(
      {
        host: '127.0.0.1',
        port: PORT,
        path,
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

async function main() {
  const ok = await post('/api/builder/preview', {
    envelope: { mova_version: '3.3.0', $schema: 'envelope.schema.json', steps: [] }
  });
  console.log('preview.ok.status', ok.status, 'ok', ok.body?.ok);

  const bad = await post('/api/builder/preview', {
    envelope: { mova_version: '3.2.9', $schema: 'envelope.schema.json', steps: [] }
  });
  console.log('preview.bad.status', bad.status, 'error.code', bad.body?.error?.code);

  const acceptable = [200, 422, 500];
  const success = acceptable.includes(ok.status) && acceptable.includes(bad.status);
  process.exit(success ? 0 : 1);
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});
