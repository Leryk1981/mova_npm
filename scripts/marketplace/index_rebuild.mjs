import { promises as fs } from 'node:fs';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

const MARKETPLACE_DIR = path.join(projectRoot, 'marketplace');
const PACKAGES_DIR = path.join(MARKETPLACE_DIR, 'packages');
const INDEX_FILE = path.join(MARKETPLACE_DIR, 'index.json');

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

const PACKAGE_NAME_RE = /^(?<id>[A-Za-z0-9._-]+)-(?<version>\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)$/;

function parsePackageName(fileName) {
  if (!fileName.endsWith('.zip')) {
    return null;
  }

  const base = fileName.slice(0, -4);
  const match = base.match(PACKAGE_NAME_RE);
  if (!match) {
    return null;
  }

  const { id, version } = match.groups;
  return { id, version };
}

async function sha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function collectPackages() {
  await ensureDir(PACKAGES_DIR);
  const files = await fs.readdir(PACKAGES_DIR);
  const entries = [];

  for (const fileName of files) {
    const info = parsePackageName(fileName);
    if (!info) {
      console.warn(`Skipping file with unexpected name: ${fileName}`);
      continue;
    }

    const filePath = path.join(PACKAGES_DIR, fileName);
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      continue;
    }

    const hash = await sha256(filePath);

    entries.push({
      id: info.id,
      version: info.version,
      file: path.posix.join('packages', fileName),
      size: stat.size,
      sha256: hash,
      mtime: stat.mtime.toISOString(),
    });
  }

  entries.sort((a, b) => {
    if (a.id === b.id) {
      return a.version.localeCompare(b.version, undefined, { numeric: true, sensitivity: 'base' });
    }
    return a.id.localeCompare(b.id);
  });

  return entries;
}

async function writeIndex(packages) {
  await ensureDir(MARKETPLACE_DIR);
  const payload = {
    generatedAt: new Date().toISOString(),
    packages,
  };
  await fs.writeFile(INDEX_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

async function main() {
  const packages = await collectPackages();
  await writeIndex(packages);
  console.log(`Marketplace index rebuilt with ${packages.length} package(s).`);
  console.log(`Index file: ${path.relative(projectRoot, INDEX_FILE)}`);
}

main().catch(err => {
  console.error('Failed to rebuild marketplace index:', err);
  process.exitCode = 1;
});
