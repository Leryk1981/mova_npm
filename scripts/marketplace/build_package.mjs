import { promises as fs } from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = { dir: 'marketplace/work/example_pkg' };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--dir' && argv[i + 1]) {
      args.dir = argv[i + 1];
      i++;
    } else if (token.startsWith('--dir=')) {
      args.dir = token.slice('--dir='.length);
    }
  }
  return args;
}

async function ensureDir(target) {
  await fs.mkdir(target, { recursive: true });
}

async function readManifest(dir) {
  const manifestPath = path.join(dir, 'manifest.json');
  const manifestRaw = await fs.readFile(manifestPath, 'utf-8');
  const manifest = JSON.parse(manifestRaw);
  if (!manifest.id || !manifest.version) {
    throw new Error(`Manifest ${manifestPath} must contain id and version`);
  }
  return manifest;
}

async function collectFiles(baseDir) {
  const files = {};
  async function walk(relative = '') {
    const currentDir = path.join(baseDir, relative);
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const entryRel = path.join(relative, entry.name);
      const posixRel = entryRel.split(path.sep).join('/');
      if (entry.isDirectory()) {
        await walk(entryRel);
      } else {
        const fullPath = path.join(baseDir, entryRel);
        const content = await fs.readFile(fullPath, 'utf-8');
        files[posixRel] = content;
      }
    }
  }
  await walk('');
  return files;
}

async function buildPackage(dir) {
  const absDir = path.resolve(dir);
  const manifest = await readManifest(absDir);
  const files = await collectFiles(absDir);
  const packageData = { manifest, files };

  const packagesDir = path.resolve('marketplace', 'packages');
  await ensureDir(packagesDir);
  const fileName = `${manifest.id}-${manifest.version}.zip`;
  const targetPath = path.join(packagesDir, fileName);
  await fs.writeFile(targetPath, JSON.stringify(packageData, null, 2));
  console.log(`Package built: ${targetPath}`);
  return { manifest, targetPath };
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    await buildPackage(options.dir);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
