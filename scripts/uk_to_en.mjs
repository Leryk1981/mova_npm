import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
let inputPath = args.find(arg => !arg.startsWith('--'));
let outDir = 'dist/canonical';
const passthrough = [];

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith('--')) {
    if (arg === '--out' && i + 1 < args.length) {
      outDir = args[++i];
    } else if (arg.startsWith('--out=')) {
      outDir = arg.split('=')[1];
    } else {
      passthrough.push(arg);
    }
  } else if (arg === inputPath) {
    continue;
  }
}

if (!inputPath) {
  inputPath = 'templates/ua';
}

const resolvedInput = path.resolve(projectRoot, inputPath);
const resolvedOut = path.resolve(projectRoot, outDir);

fs.rmSync(resolvedOut, { recursive: true, force: true });
fs.mkdirSync(resolvedOut, { recursive: true });

if (!fs.existsSync(resolvedInput)) {
  console.warn(`[skip] ${inputPath} not found; created empty ${path.relative(projectRoot, resolvedOut)}`);
  process.exit(0);
}

const translateScript = path.resolve(projectRoot, 'scripts/translation/translate.mjs');
const finalArgs = [translateScript, inputPath];

if (!passthrough.some(arg => arg.startsWith('--lang'))) {
  finalArgs.push('--lang=uk');
}

if (!passthrough.some(arg => arg === '--out' || arg.startsWith('--out='))) {
  finalArgs.push(`--out=${outDir}`);
}

finalArgs.push(...passthrough);

const child = spawn(process.execPath, finalArgs, {
  cwd: projectRoot,
  stdio: 'inherit'
});

child.on('close', code => {
  process.exit(code);
});

child.on('error', err => {
  console.error(err);
  process.exit(1);
});
