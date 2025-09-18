import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const cliFilePath = path.join(projectRoot, 'cli.mjs');

const source = await readFile(cliFilePath, 'utf8');

const literalPattern = /(['"`])((?:\\.|(?!\1)[\s\S])*)\1/g;
const violations = [];
let match;

while ((match = literalPattern.exec(source)) !== null) {
    const literal = match[2];
    const trimmed = literal.trim();

    if (!trimmed) {
        continue;
    }

    if (!/[A-Za-z]/.test(trimmed)) {
        continue;
    }

    if (!/\s/.test(trimmed)) {
        continue;
    }

    const preceding = source.slice(0, match.index);
    const line = preceding.split('\n').length;
    violations.push({ literal, line });
}

if (violations.length > 0) {
    console.error('Found hard-coded CLI strings. Move user-facing text to src/i18n/locales.');
    for (const violation of violations) {
        console.error(`  line ${violation.line}: "${violation.literal}"`);
    }
    process.exit(1);
}
