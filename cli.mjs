import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { DEFAULT_LANGUAGE, isSupportedLanguage, setLanguage, t } from './src/i18n/i18n.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rawArgs = process.argv.slice(2);
const filteredArgs = [];
let languageFromFlag;
let langFlagProvided = false;

for (let index = 0; index < rawArgs.length; index += 1) {
    const value = rawArgs[index];

    if (value === '--lang') {
        langFlagProvided = true;
        const nextValue = rawArgs[index + 1];
        if (typeof nextValue === 'string' && !nextValue.startsWith('--')) {
            languageFromFlag = nextValue;
            index += 1;
        } else {
            console.warn(t('warnings.missingLanguageArgument'));
        }
        continue;
    }

    if (value.startsWith('--lang=')) {
        langFlagProvided = true;
        const potential = value.slice('--lang='.length);
        if (potential) {
            languageFromFlag = potential;
        } else {
            console.warn(t('warnings.missingLanguageArgument'));
        }
        continue;
    }

    filteredArgs.push(value);
}

const environmentLanguage = process.env.MOVA_LANG;
if (langFlagProvided && environmentLanguage) {
    console.warn(t('cli.ignoredEnvLanguage'));
}

let requestedLanguage = langFlagProvided ? languageFromFlag : environmentLanguage;
if (typeof requestedLanguage === 'string') {
    requestedLanguage = requestedLanguage.trim().toLowerCase();
}

if (requestedLanguage && !isSupportedLanguage(requestedLanguage)) {
    console.warn(t('warnings.unsupportedLanguage', { requested: requestedLanguage }));
    requestedLanguage = DEFAULT_LANGUAGE;
}

setLanguage(requestedLanguage ?? DEFAULT_LANGUAGE);

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