import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { spawn } from 'node:child_process';

import {
  assertPackageId,
  assertPackageVersion,
  composeArchiveFileName,
  relativeToProject,
} from './common.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

const DEFAULT_OUTPUT_DIR = path.join(projectRoot, 'marketplace', 'packages');
const METADATA_FILES = ['package.json', 'metadata.json', 'manifest.json'];
const NESTED_METADATA_KEYS = ['package', 'marketplace', 'meta'];
const DEFAULT_EXCLUDE_NAMES = new Set(['.DS_Store', 'Thumbs.db', '.git', 'node_modules']);
const ZIP_EXCLUDE_GLOBS = [
  'node_modules/*',
  'node_modules/**',
  '.git/*',
  '.git/**',
  '*.DS_Store',
  '*/.DS_Store',
  'Thumbs.db',
  '*/Thumbs.db',
];

function showUsage() {
  console.log(`Usage: node ${path.relative(projectRoot, __filename)} --dir <source> [options]\n\n` +
`Options:\n` +
`  --dir <path>          Source directory that contains package files (required).\n` +
`  --out-dir <path>      Output directory for generated archive (default: marketplace/packages).\n` +
`  --id <value>          Override package id detected from metadata.\n` +
`  --version <value>     Override package version detected from metadata.\n` +
`  --force               Overwrite output archive if it already exists.\n` +
`  --help                Show this help message.\n`);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('-')) {
      args._.push(token);
      continue;
    }

    if (token === '--') {
      for (let j = i + 1; j < argv.length; j += 1) {
        args._.push(argv[j]);
      }
      break;
    }

    const [flag, value] = token.replace(/^--/, '').split('=', 2);
    const nextIsValue = value === undefined ? argv[i + 1] : undefined;
    const needsValue = value === undefined && nextIsValue !== undefined && !nextIsValue.startsWith('-');

    let resolvedValue = value;
    if (needsValue) {
      resolvedValue = nextIsValue;
      i += 1;
    }

    switch (flag) {
      case 'dir':
        args.dir = resolvedValue;
        break;
      case 'out-dir':
        args.outDir = resolvedValue;
        break;
      case 'id':
        args.id = resolvedValue;
        break;
      case 'version':
        args.version = resolvedValue;
        break;
      case 'force':
        args.force = true;
        if (resolvedValue && resolvedValue !== 'true') {
          // Support explicit --force=false to disable the flag when forwarded.
          args.force = resolvedValue !== 'false';
        }
        break;
      case 'help':
        args.help = true;
        break;
      default:
        throw new Error(`Unknown option --${flag}`);
    }
  }
  if (!args.dir && args._.length > 0) {
    [args.dir] = args._;
  }
  return args;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function pickString(source, ...keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function extractMetaFromObject(obj, seen) {
  if (!obj || typeof obj !== 'object') {
    return {};
  }
  if (seen.has(obj)) {
    return {};
  }
  seen.add(obj);

  let id = pickString(obj, 'id', 'packageId', 'package_id', 'name', 'slug');
  let version = pickString(obj, 'version', 'packageVersion', 'package_version', 'release');

  for (const key of NESTED_METADATA_KEYS) {
    if (id && version) {
      break;
    }
    const nested = obj[key];
    if (!nested || typeof nested !== 'object') {
      continue;
    }
    const nestedMeta = extractMetaFromObject(nested, seen);
    if (!id && nestedMeta.id) {
      id = nestedMeta.id;
    }
    if (!version && nestedMeta.version) {
      version = nestedMeta.version;
    }
  }

  const trimmed = {};
  if (typeof id === 'string' && id.trim()) {
    trimmed.id = id.trim();
  }
  if (typeof version === 'string' && version.trim()) {
    trimmed.version = version.trim();
  }
  return trimmed;
}

async function readMetadata(sourceDir) {
  for (const fileName of METADATA_FILES) {
    const filePath = path.join(sourceDir, fileName);
    if (!(await pathExists(filePath))) {
      continue;
    }
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content);
      const meta = extractMetaFromObject(data, new Set());
      if (meta.id || meta.version) {
        return { ...meta, source: fileName };
      }
    } catch (error) {
      throw new Error(`Failed to read metadata from ${filePath}: ${error.message}`);
    }
  }
  return { id: undefined, version: undefined, source: undefined };
}

async function gatherPackageInfo(sourceDir, overrides) {
  const { id: fileId, version: fileVersion, source } = await readMetadata(sourceDir);

  const id = overrides.id?.trim() || fileId;
  const version = overrides.version?.trim() || fileVersion;

  if (!id) {
    const hint = source ? ` from ${source}` : '';
    throw new Error(`Unable to determine package id${hint}. Provide --id explicitly or add it to metadata.`);
  }
  if (!version) {
    const hint = source ? ` from ${source}` : '';
    throw new Error(`Unable to determine package version${hint}. Provide --version explicitly or add it to metadata.`);
  }

  return {
    id: assertPackageId(id),
    version: assertPackageVersion(version),
  };
}

async function collectEntries(zip, directory, relativeBase = '') {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  if (entries.length === 0 && relativeBase) {
    zip.addFile(`${relativeBase}/`, Buffer.alloc(0));
    return;
  }

  for (const entry of entries) {
    if (DEFAULT_EXCLUDE_NAMES.has(entry.name)) {
      continue;
    }
    const absolutePath = path.join(directory, entry.name);
    const archivePath = relativeBase ? `${relativeBase}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      await collectEntries(zip, absolutePath, archivePath);
    } else if (entry.isFile()) {
      const content = await fs.readFile(absolutePath);
      zip.addFile(archivePath.split(path.sep).join('/'), content);
    } else if (entry.isSymbolicLink()) {
      const stats = await fs.stat(absolutePath);
      if (stats.isDirectory()) {
        await collectEntries(zip, absolutePath, archivePath);
      } else if (stats.isFile()) {
        const content = await fs.readFile(absolutePath);
        zip.addFile(archivePath.split(path.sep).join('/'), content);
      }
    }
  }
}

let admZipChecked = false;
let AdmZipCtor;
let zipFallbackNotified = false;

async function loadAdmZip() {
  if (admZipChecked) {
    return AdmZipCtor;
  }
  admZipChecked = true;
  try {
    const module = await import('adm-zip');
    AdmZipCtor = module?.default ?? module;
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND' || /Cannot find module 'adm-zip'/.test(String(error?.message))) {
      AdmZipCtor = null;
    } else {
      throw error;
    }
  }
  return AdmZipCtor;
}

async function createArchiveWithAdmZip(sourceDir, targetPath) {
  const AdmZip = await loadAdmZip();
  if (!AdmZip) {
    return false;
  }
  const zip = new AdmZip();
  await collectEntries(zip, sourceDir);
  await new Promise((resolve, reject) => {
    zip.writeZip(targetPath, error => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
  return true;
}

async function createArchiveWithZipCli(sourceDir, targetPath) {
  const args = ['-q', '-r', targetPath, '.'];
  for (const pattern of ZIP_EXCLUDE_GLOBS) {
    args.push('-x', pattern);
  }

  return new Promise((resolve, reject) => {
    const child = spawn('zip', args, { cwd: sourceDir });
    let stderr = '';
    child.stderr?.on('data', chunk => {
      stderr += chunk.toString();
    });
    child.on('close', code => {
      if (code === 0) {
        if (stderr.trim()) {
          console.warn(stderr.trim());
        }
        resolve();
      } else {
        const message = stderr.trim() || `zip command exited with code ${code}`;
        const error = new Error(message);
        error.code = code;
        reject(error);
      }
    });
    child.on('error', error => {
      if (error.code === 'ENOENT') {
        reject(new Error('zip command not found in PATH and adm-zip module is unavailable. Install zip or add adm-zip to dependencies.'));
      } else {
        reject(error);
      }
    });
  });
}

async function ensureOutputDir(outDir) {
  await fs.mkdir(outDir, { recursive: true });
}

async function buildArchive(sourceDir, outDir, packageInfo, force) {
  await ensureOutputDir(outDir);

  const archiveName = composeArchiveFileName(packageInfo.id, packageInfo.version);
  const targetPath = path.join(outDir, archiveName);

  if (await pathExists(targetPath)) {
    if (!force) {
      throw new Error(`Output archive already exists: ${targetPath}. Use --force to overwrite.`);
    }
    await fs.unlink(targetPath);
  }

  const usedAdmZip = await createArchiveWithAdmZip(sourceDir, targetPath);
  if (!usedAdmZip) {
    if (!zipFallbackNotified) {
      console.warn('adm-zip module not available, falling back to system zip command.');
      zipFallbackNotified = true;
    }
    await createArchiveWithZipCli(sourceDir, targetPath);
  }
  return targetPath;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    showUsage();
    return;
  }
  if (!args.dir) {
    showUsage();
    throw new Error('Missing required option --dir.');
  }

  const sourceDir = relativeToProject(projectRoot, args.dir);
  const stats = await fs.stat(sourceDir).catch(() => null);
  if (!stats || !stats.isDirectory()) {
    throw new Error(`Source directory not found: ${sourceDir}`);
  }

  const outDir = args.outDir ? relativeToProject(projectRoot, args.outDir) : DEFAULT_OUTPUT_DIR;
  const packageInfo = await gatherPackageInfo(sourceDir, { id: args.id, version: args.version });
  const archivePath = await buildArchive(sourceDir, outDir, packageInfo, Boolean(args.force));

  const relativeOutput = path.relative(projectRoot, archivePath);
  console.log(`Marketplace package built: ${packageInfo.id}@${packageInfo.version}`);
  console.log(`Archive: ${relativeOutput}`);
}

main().catch(error => {
  console.error('Failed to build marketplace package:', error.message ?? error);
  process.exitCode = 1;
});
