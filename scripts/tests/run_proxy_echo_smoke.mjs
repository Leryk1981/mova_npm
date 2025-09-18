import http from 'node:http';
import fs from 'node:fs';

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
        res.on('data', c => body += c);
        res.on('end', () => {
          let json = {};
          try { json = body ? JSON.parse(body) : {}; } catch {}
          resolve({ status: res.statusCode, body: json });
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const ping = await post('/api/webhook/proxy/echo_local', { hello: 'world' });
  console.log('proxy.status', ping.status, 'proxy.body.ok', ping.body?.ok);
  const logExists = fs.existsSync('out/webhooks.ndjson');
  process.exit(ping.status === 200 && ping.body?.ok && logExists ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(2); });
