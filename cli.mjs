import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const [,, command, ...args] = process.argv;

const scripts = {
    'parse': {
        path: 'scripts/language/parse_vnl.mjs',
        description: 'Парсить речення VNL і генерує український план.\n  Приклад: parse "send message to general"'
    },
    'run': {
        path: 'scripts/runtime/run_plan.mjs',
        description: 'Виконує канонічний (англійський) план.\n  Приклад: run canonical/plan_min.json'
    },
    'build': {
        npm: 'build:ua',
        description: 'Збирає та валідує українські шаблони, створюючи канонічні файли.'
    },
    'translate:reverse': {
        npm: 'translate:en-ua',
        description: 'Перекладає всі канонічні файли з /canonical на українську в /templates/ua/from-en.'
    },
    'fingerprint': {
        npm: 'build:fingerprint',
        description: 'Генерує "відбиток" (хеші) для всіх схем у build/schema_fingerprint.json.'
    },
    'help': {
        description: 'Показує цю довідку.'
    }
};

function printHelp() {
    console.log('--- Інтерфейс командного рядка MOVA ---');
    console.log('\nВикористання: npm run cli -- <команда> [аргументи]\n');
    console.log('Доступні команди:\n');
    for (const cmd in scripts) {
        // Pad the command name for alignment
        const paddedCmd = cmd.padEnd(20, ' ');
        console.log(`  ${paddedCmd} ${scripts[cmd].description}`);
    }
    console.log('\n----------------------------------------');
}

if (!command || command === 'help') {
    printHelp();
    process.exit(0);
}

const scriptConfig = scripts[command];

if (!scriptConfig) {
    console.error(`❌ Невідома команда: "${command}"`);
    printHelp();
    process.exit(1);
}

// Function to run a node script
function runNodeScript(scriptPath, scriptArgs) {
    const fullPath = resolve(__dirname, scriptPath);
    // For VNL parser, we need to join args back into a sentence
    const finalArgs = scriptPath.includes('parse_vnl') ? [scriptArgs.join(' ')] : scriptArgs;

    const child = spawn('node', [fullPath, ...finalArgs], { stdio: 'inherit' });

    child.on('close', (code) => {
        if (code !== 0) {
            console.error(`\n💥 Скрипт завершився з кодом помилки: ${code}`);
        }
        process.exit(code);
    });

    child.on('error', (err) => {
        console.error(`💥 Помилка запуску скрипта ${scriptPath}:`, err);
        process.exit(1);
    });
}

// Function to run an npm script
function runNpmScript(scriptName) {
    // 'shell: true' is important for cross-platform compatibility, especially on Windows
    const child = spawn('npm', ['run', scriptName], { stdio: 'inherit', shell: true });

    child.on('close', (code) => {
        if (code !== 0) {
            console.error(`\n💥 npm-скрипт завершився з кодом помилки: ${code}`);
        }
        process.exit(code);
    });

    child.on('error', (err) => {
        console.error(`💥 Помилка запуску npm-скрипта ${scriptName}:`, err);
        process.exit(1);
    });
}


if (scriptConfig.path) {
    // It's a direct node script
    runNodeScript(scriptConfig.path, args);
} else if (scriptConfig.npm) {
    // It's an npm script
    runNpmScript(scriptConfig.npm);
}