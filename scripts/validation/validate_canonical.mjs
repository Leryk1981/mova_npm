import { spawnSync } from 'child_process';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = resolve(__dirname, '../..');
const args = process.argv.slice(2);

function collectCanonicalTargets() {
  const targets = [];

  if (args.length > 0) {
    return [...args];
  }

  const canonicalDirs = [
    { label: 'canonical', dir: resolve(projectRoot, 'canonical') },
    { label: 'templates/canonical', dir: resolve(projectRoot, 'templates/canonical') }
  ];

  for (const { label, dir } of canonicalDirs) {
    if (!existsSync(dir)) continue;

    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'manifest.json') {
        targets.push(join(label, entry.name));
      }
    }
  }

  return targets;
}

function enforceMovaVersion(targets) {
  for (const target of targets) {
    const absolutePath = resolve(projectRoot, target);
    let data;

    try {
      const raw = readFileSync(absolutePath, 'utf-8');
      data = JSON.parse(raw);
    } catch (error) {
      console.error(`[version-gate] ${target}: failed to load for mova_version check`);
      throw error;
    }

    if (!Object.prototype.hasOwnProperty.call(data ?? {}, 'mova_version')) {
      continue;
    }

    const version = data?.mova_version;
    const versionMatches = typeof version === 'string' && /^3\.3\.\d+$/.test(version);

    if (!versionMatches) {
      const found = version === undefined ? 'undefined' : version;
      console.error(`[version-gate] ${target}: only mova_version 3.3.x is accepted (found: ${found})`);
      process.exit(1);
    }
  }
}

const targets = collectCanonicalTargets();
enforceMovaVersion(targets);

const scriptPath = resolve(__dirname, 'validate_schemas.mjs');

const result = spawnSync(process.execPath, [scriptPath, ...args], {
  stdio: 'inherit'
});

if (result.error) {
  console.error('Failed to run validate_schemas:', result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);
