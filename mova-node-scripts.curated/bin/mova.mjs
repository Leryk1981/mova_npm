#!/usr/bin/env node
import yargs from 'yargs'; import { hideBin } from 'yargs/helpers';
import validatePlan from '../lib/validatePlan.mjs';
import validateRoute from '../lib/validateRoute.mjs';
import schemaFingerprint from '../lib/schemaFingerprint.mjs';
import templatesLint from '../lib/templatesLint.mjs';
import lexiconCoverage from '../lib/lexiconCoverage.mjs';
yargs(hideBin(process.argv))
  .scriptName('mova')
  .command('validate <kind>', 'Validate a MOVA file', y=>y
    .positional('kind', { choices: ['plan','route'] })
    .option('file', { type: 'string', demandOption: true })
    .option('schemas-dir', { type: 'string', default: '../mova-schemas-kit/schemas' })
  , args => { const { kind, file, schemasDir } = args;
    const code = (kind==='plan') ? validatePlan({ file, schemasDir }) : validateRoute({ file, schemasDir });
    process.exit(code);
  })
  .command('schema fingerprint', 'Compute schema fingerprints', y=>y
    .option('schemas-dir', { type: 'string', default: '../mova-schemas-kit/schemas' })
    .option('out', { type: 'string' })
  , async args => { const code = await schemaFingerprint({ schemasDir: args.schemasDir, out: args.out }); process.exit(code); })
  .command('templates lint', 'Lint MOVA template outputs', y=>y
    .option('dir', { type: 'string', demandOption: true })
  , args => { const code = templatesLint({ dir: args.dir }); process.exit(code); })
  .command('lexicon coverage', 'Check lexicon keys coverage vs frames', y=>y
    .option('lexicon', { type: 'string', demandOption: true })
    .option('frames', { type: 'string', demandOption: true })
  , args => { const code = lexiconCoverage({ lexicon: args.lexicon, frames: args.frames }); process.exit(code); })
  .demandCommand(1).help().strict().parse();
