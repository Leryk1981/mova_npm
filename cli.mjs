import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { DEFAULT_LANGUAGE, getSupportedLanguages, isSupportedLanguage, setLanguage, t } from './src/i18n/i18n.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LANGUAGE_ENV_VAR = 'MOVA_LANG';

const rawArgs = process.argv.slice(2);
const filteredArgs = [];
let languageFromFlag;
let langFlagResolved = false;
let stopParsingFlags = false;

function normalizeLanguageCode(value) {
    if (typeof value !== 'string') {
        return undefined;
    }

    const normalized = value.trim().toLowerCase();
    return normalized === '' ? undefined : normalized;
}

for (let index = 0; index < rawArgs.length; index += 1) {
    const value = rawArgs[index];

    if (!stopParsingFlags && value === '--') {
        stopParsingFlags = true;
        continue;
    }

    if (!stopParsingFlags && value === '--lang') {
        const nextValue = rawArgs[index + 1];
        const normalized = normalizeLanguageCode(nextValue);
        if (normalized) {
            languageFromFlag = normalized;
            langFlagResolved = true;
            index += 1;
        } else {
            console.warn(t('warnings.missingLanguageArgument'));
        }
        continue;
    }

    if (!stopParsingFlags && value.startsWith('--lang=')) {
        const potential = value.slice('--lang='.length);
        const normalized = normalizeLanguageCode(potential);
        if (normalized) {
            languageFromFlag = normalized;
            langFlagResolved = true;
        } else {
            console.warn(t('warnings.missingLanguageArgument'));
        }
        continue;
    }

    filteredArgs.push(value);
}

const environmentLanguage = normalizeLanguageCode(process.env[LANGUAGE_ENV_VAR]);

if (langFlagResolved && environmentLanguage && environmentLanguage !== languageFromFlag) {
    console.warn(t('cli.ignoredEnvLanguage', { envLanguage: environmentLanguage, envVar: LANGUAGE_ENV_VAR }));
}

let requestedLanguage = langFlagResolved ? languageFromFlag : environmentLanguage;

if (requestedLanguage && !isSupportedLanguage(requestedLanguage)) {
    console.warn(t('warnings.unsupportedLanguage', { requested: requestedLanguage }));
    requestedLanguage = DEFAULT_LANGUAGE;
}

const activeLanguage = setLanguage(requestedLanguage ?? DEFAULT_LANGUAGE);
process.env[LANGUAGE_ENV_VAR] = activeLanguage;

const [command, ...args] = filteredArgs;

const scripts = {
    'parse': {
        path: 'scripts/language/parse_vnl.mjs',
        descriptionKey: 'commands.parse.description',
        exampleKey: 'commands.parse.example'
    },
    'run': {
        path: 'scripts/runtime/run_plan.mjs',
        descriptionKey: 'commands.run.description',
        exampleKey: 'commands.run.example'
    },
    'build': {
        npm: 'build:ua',
        descriptionKey: 'commands.build.description',
        exampleKey: 'commands.build.example'
    },
    'translate:reverse': {
        npm: 'translate:en-ua',
        descriptionKey: 'commands.translateReverse.description',
        exampleKey: 'commands.translateReverse.example'
    },
    'fingerprint': {
        npm: 'build:fingerprint',
        descriptionKey: 'commands.fingerprint.description',
        exampleKey: 'commands.fingerprint.example'
    },
    'help': {
        descriptionKey: 'commands.help.description'
    }
};

const longestCommandLength = Object.keys(scripts)
    .reduce((max, name) => Math.max(max, name.length), 0);

function printHelp() {
    console.log(t('cli.header'));
    console.log('');
    console.log(t('cli.usage'));
    console.log('');
    const languageList = getSupportedLanguages().join(', ');
    console.log(t('cli.languageHint', {
        defaultLanguage: DEFAULT_LANGUAGE,
        envVar: LANGUAGE_ENV_VAR,
        languages: languageList || DEFAULT_LANGUAGE
    }));
    console.log('');
    console.log(t('cli.availableCommands'));
    console.log('');

    for (const cmd of Object.keys(scripts)) {
        const config = scripts[cmd];
        const description = t(config.descriptionKey);
        const paddedCmd = cmd.padEnd(longestCommandLength + 2, ' ');
        console.log(t('cli.commandItem', { command: paddedCmd, description }));

        if (config.exampleKey) {
            const example = t(config.exampleKey);
            if (example !== config.exampleKey) {
                console.log(t('cli.example', { example }));
            }
        }
    }

    console.log('');
    console.log(t('cli.footer'));
}

if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    process.exit(0);
}

const scriptConfig = scripts[command];

if (!scriptConfig) {
    console.error('❌ ' + t('errors.unknownCommand', { command }));
    printHelp();
    process.exit(1);
}

function runNodeScript(scriptPath, scriptArgs) {
    const fullPath = resolve(__dirname, scriptPath);
    const finalArgs = scriptPath.includes('parse_vnl') ? [scriptArgs.join(' ')] : scriptArgs;

    const child = spawn('node', [fullPath, ...finalArgs], { stdio: 'inherit' });

    child.on('close', (code) => {
        if (code !== 0) {
            console.error('');
            console.error('💥 ' + t('errors.scriptFailed', { code }));
        }
        process.exit(code);
    });

    child.on('error', (err) => {
        console.error('💥 ' + t('errors.scriptSpawn', { script: scriptPath }));
        console.error(err);
        process.exit(1);
    });
}

function runNpmScript(scriptName) {
    const child = spawn('npm', ['run', scriptName], { stdio: 'inherit', shell: true });

    child.on('close', (code) => {
        if (code !== 0) {
            console.error('');
            console.error('💥 ' + t('errors.npmScriptFailed', { code }));
        }
        process.exit(code);
    });

    child.on('error', (err) => {
        console.error('💥 ' + t('errors.npmScriptSpawn', { script: scriptName }));
        console.error(err);
        process.exit(1);
    });
}

if (scriptConfig.path) {
    runNodeScript(scriptConfig.path, args);
} else if (scriptConfig.npm) {
    runNpmScript(scriptConfig.npm);
}