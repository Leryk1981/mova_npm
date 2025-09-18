import http from 'node:http';

function post(path, payload) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(payload));
    const req = http.request(
      {
        host: 'localhost',
        port: 3000,
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
          resolve({ status: res.statusCode, body: body ? JSON.parse(body) : {} });
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
  console.log('OK.status', ok.status, 'OK.body.ok', ok.body.ok);

  const bad = await post('/api/builder/preview', {
    envelope: { mova_version: '3.2.9', $schema: 'envelope.schema.json', steps: [] }
  });
  console.log('BAD.status', bad.status, 'BAD.body.error.code', bad.body?.error?.code);
  process.exit((ok.status === 200 && ok.body.ok === true && bad.status === 422) ? 0 : 1);
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});
