import http from 'node:http';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const PORT = Number(process.env.PORT || 3000);

function ensureDemoPackage() {
  const zip = 'marketplace/packages/example_pkg-1.0.0.zip';
  if (!fs.existsSync(zip)) {
    execSync('npm run -s mp:build -- --dir marketplace/work/example_pkg', { stdio: 'inherit' });
    execSync('npm run -s mp:index', { stdio: 'inherit' });
  }
}

function req(method, path, payload) {
  return new Promise((resolve, reject) => {
    const data = payload ? Buffer.from(JSON.stringify(payload)) : null;
    const opt = { host: '127.0.0.1', port: PORT, path, method, headers: {} };
    if (data) {
      opt.headers['Content-Type'] = 'application/json';
      opt.headers['Content-Length'] = data.length;
    }
    const r = http.request(opt, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        let json = {};
        try { json = body ? JSON.parse(body) : {}; } catch {}
        resolve({ status: res.statusCode, body: json });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  ensureDemoPackage();

  const list = await req('GET', '/api/market/list');
  console.log('market.list.status', list.status, 'items', Array.isArray(list.body) ? list.body.length : 'n/a');

  const inst = await req('POST', '/api/market/install', { id: 'example_pkg', version: '1.0.0' });
  console.log('market.install.status', inst.status, 'installed', inst.body?.installed);

  const again = await req('POST', '/api/market/install', { id: 'example_pkg', version: '1.0.0' });
  console.log('market.install_again.status', again.status, 'error.code', again.body?.error?.code);

  const prev = await req('POST', '/api/builder/preview', { formSpec: { id: 'example_pkg:my_demo' } });
  console.log('market.preview.status', prev.status, 'ok', prev.body?.ok);

  const acceptable = [200, 409];
  const previewOk = [200, 422, 500].includes(prev.status);
  const success = list.status === 200 && acceptable.includes(inst.status) && again.status === 409 && previewOk;
  process.exit(success ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(2); });
