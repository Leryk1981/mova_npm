import { promises as fs } from 'node:fs';
import path from 'node:path';

async function ensureDir(target) {
  await fs.mkdir(target, { recursive: true });
}

async function readPackagesDir(dir) {
  try {
    return await fs.readdir(dir);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function readPackage(filePath) {
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

async function buildIndex(packagesDir) {
  const files = await readPackagesDir(packagesDir);
  const items = [];
  for (const file of files) {
    if (!file.endsWith('.zip')) {
      continue;
    }
    const filePath = path.join(packagesDir, file);
    try {
      const pkg = await readPackage(filePath);
      const { manifest } = pkg;
      if (!manifest?.id || !manifest?.version) {
        console.warn(`Skipping ${file}: missing id/version in manifest.`);
        continue;
      }
      items.push({
        id: manifest.id,
        version: manifest.version,
        name: manifest.name || manifest.id,
        description: manifest.description || '',
        forms: manifest.forms || [],
        file: path.posix.join('marketplace', 'packages', file)
      });
    } catch (err) {
      console.warn(`Skipping ${file}: ${err.message}`);
    }
  }
  return items;
}

async function main() {
  const packagesDir = path.resolve('marketplace', 'packages');
  const indexPath = path.resolve('marketplace', 'index.json');
  try {
    const items = await buildIndex(packagesDir);
    await ensureDir(path.dirname(indexPath));
    await fs.writeFile(indexPath, JSON.stringify(items, null, 2));
    console.log(`Marketplace index rebuilt (${items.length} item(s)).`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
