import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const scriptPath = resolve(__dirname, 'validate_schemas.mjs');

const result = spawnSync(process.execPath, [scriptPath, ...args], {
  stdio: 'inherit'
});

if (result.error) {
  console.error('Failed to run validate_schemas:', result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);
