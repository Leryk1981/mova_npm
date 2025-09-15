import { readdirSync } from 'fs';
import { resolve, dirname, basename, join } from 'path';
import { fileURLToPath } from 'url';

// --- Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

const canonicalDir = resolve(projectRoot, 'canonical');

try {
  const files = readdirSync(canonicalDir).filter(f => f.includes('plan') && f.endsWith('.json'));

  const manifest = {};
  for (const file of files) {
    // Use basename without extension as the logical plan name
    const planName = basename(file, '.json');
    manifest[planName] = join('canonical', file);
  }

  console.log(JSON.stringify(manifest, null, 2));
} catch (error) {
  // Fail gracefully if the canonical directory doesn't exist yet
  if (error.code !== 'ENOENT') throw error;
  console.log('{}'); // Output empty manifest
}