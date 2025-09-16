import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { spawn } from 'child_process';

// Оскільки ми використовуємо ES Modules, __dirname не доступний.
// Це стандартний спосіб отримати шлях до поточної директорії.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

const TEMPLATES_UA_DIR = path.join(__dirname, 'templates', 'ua');
const CANONICAL_DIR = path.join(__dirname, 'canonical');

// Middleware для парсингу JSON тіла запитів
app.use(express.json());

// 1. Сервіруємо статичні файли з директорії 'ui' (index.html, app.js, etc.)
app.use(express.static(path.join(__dirname, 'ui')));

// 2. Сервіруємо статичні файли з кореневої директорії проєкту.
// Це потрібно, щоб frontend міг завантажувати /templates/ua/*, /lexicon_uk.json і т.д.
app.use(express.static(path.join(__dirname)));

// === ІСНУЮЧІ API ENDPOINTS ===

// API endpoint для отримання списку шаблонів
app.get('/api/templates', async (req, res) => {
    try {
        const files = await fs.readdir(TEMPLATES_UA_DIR);
        const jsonFiles = files.filter(file => file.endsWith('.json'));
        res.json(jsonFiles);
    } catch (error) {
        console.error('Не вдалося прочитати директорію шаблонів:', error);
        res.status(500).json({ message: 'Не вдалося отримати список шаблонів.' });
    }
});

// API endpoint для збереження файлу
app.post('/api/save-template', async (req, res) => {
    const { filename, content } = req.body;

    if (!filename || content === undefined) {
        return res.status(400).json({ message: 'Потрібно вказати ім\'я файлу та вміст.' });
    }
    if (filename.includes('..') || !filename.endsWith('.json')) {
        return res.status(400).json({ message: 'Неприпустиме ім\'я файлу.' });
    }
    try {
        const filePath = path.join(TEMPLATES_UA_DIR, filename);
        await fs.writeFile(filePath, content, 'utf-8');
        res.status(200).json({ message: `Файл ${filename} успішно збережено.` });
    } catch (error) {
        console.error('Помилка збереження файлу:', error);
        res.status(500).json({ message: 'Не вдалося зберегти файл на сервері.' });
    }
});

// === НОВІ API ENDPOINTS ===

// API endpoint для отримання списку файлів з будь-якої директорії
app.get('/api/files', async (req, res) => {
    const { path: requestedPath } = req.query;

    if (!requestedPath) {
        return res.status(400).json({ error: 'Потрібно вказати path' });
    }

    try {
        const fullPath = path.join(__dirname, requestedPath);
        const files = await fs.readdir(fullPath);
        const jsonFiles = files.filter(file => file.endsWith('.json'));
        res.json(jsonFiles);
    } catch (error) {
        console.error('Не вдалося прочитати директорію:', error);
        res.status(500).json({ error: 'Не вдалося отримати список файлів.' });
    }
});

// API endpoint для парсингу VNL
app.post('/api/parse-vnl', async (req, res) => {
    const { sentence } = req.body;

    if (!sentence) {
        return res.status(400).json({ error: 'Потрібно вказати речення' });
    }

    try {
        // Запускаємо скрипт парсингу VNL
        const { spawn } = await import('child_process');
        const child = spawn('node', ['scripts/language/parse_vnl.mjs', sentence], {
            cwd: __dirname,
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: true
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            if (code === 0) {
                try {
                    // Парсимо вивід скрипта (припускаємо JSON формат)
                    const result = JSON.parse(stdout);
                    res.json(result);
                } catch (parseError) {
                    res.status(500).json({ error: 'Не вдалося розпарсити результат парсингу' });
                }
            } else {
                res.status(500).json({ error: stderr || 'Помилка виконання парсингу' });
            }
        });

    } catch (error) {
        console.error('Помилка парсингу VNL:', error);
        res.status(500).json({ error: error.message });
    }
});

// API endpoint для виконання плану
app.post('/api/run-plan', async (req, res) => {
    const { plan, params } = req.body;

    if (!plan) {
        return res.status(400).json({ error: 'Потрібно вказати план' });
    }

    try {
        // Створюємо тимчасовий файл плану
        const tempPlanPath = path.join(__dirname, 'temp_plan.json');
        await fs.writeFile(tempPlanPath, plan, 'utf-8');

        // Запускаємо виконання плану
        const { spawn } = await import('child_process');
        const args = [tempPlanPath];
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                args.push(`${key}=${JSON.stringify(value)}`);
            });
        }

        const child = spawn('node', ['scripts/runtime/run_plan.mjs', ...args], {
            cwd: __dirname,
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: true
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', async (code) => {
            // Видаляємо тимчасовий файл
            try {
                await fs.unlink(tempPlanPath);
            } catch (e) {
                // Ігноруємо помилки видалення
            }

            if (code === 0) {
                res.json({ output: stdout });
            } else {
                res.status(500).json({ error: stderr || 'Помилка виконання плану' });
            }
        });

    } catch (error) {
        console.error('Помилка виконання плану:', error);
        res.status(500).json({ error: error.message });
    }
});

// API endpoint для валідації JSON
app.post('/api/validate', async (req, res) => {
    const { json } = req.body;

    if (!json) {
        return res.status(400).json({ error: 'Потрібно вказати JSON' });
    }

    try {
        // Створюємо тимчасовий файл для валідації
        const tempFilePath = path.join(__dirname, 'temp_validate.json');
        await fs.writeFile(tempFilePath, json, 'utf-8');

        // Запускаємо валідацію
        const { spawn } = await import('child_process');
        const child = spawn('node', ['scripts/validation/validate_schemas.mjs'], {
            cwd: __dirname,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', async (code) => {
            // Видаляємо тимчасовий файл
            try {
                await fs.unlink(tempFilePath);
            } catch (e) {
                // Ігноруємо помилки видалення
            }

            if (code === 0) {
                res.json({ valid: true });
            } else {
                res.status(400).json({ valid: false, errors: stderr.split('\n') });
            }
        });

    } catch (error) {
        console.error('Помилка валідації:', error);
        res.status(500).json({ error: error.message });
    }
});

// API endpoint для виконання команд збірки
app.post('/api/run-command', async (req, res) => {
    const { command } = req.body;

    if (!command) {
        return res.status(400).json({ error: 'Потрібно вказати команду' });
    }

    try {
        const { spawn } = await import('child_process');

        // Мапінг команд на відповідні node скрипти
        const commandMap = {
            'npm run build': [
                'node scripts/build/build_keys.mjs',
                'node scripts/translation/uk_to_en.mjs templates/ua',
                'node scripts/build/build_manifest.mjs',
                'node scripts/validation/check_lexicon_coverage.mjs'
            ],
            'npm run translate': ['node scripts/translation/uk_to_en.mjs templates/ua'],
            'npm run validate': ['node scripts/validation/validate_schemas.mjs'],
            'npm run build:manifest': ['node scripts/build/build_manifest.mjs'],
            'npm run check:lexicon': ['node scripts/validation/check_lexicon_coverage.mjs']
        };

        const scriptArgs = commandMap[command];
        if (!scriptArgs) {
            return res.status(400).json({ error: `Невідома команда: ${command}` });
        }

        // Для повної збірки виконуємо команди послідовно
        if (command === 'npm run build') {
            executeSequentialCommands(scriptArgs, res);
        } else {
            // Для окремих команд виконуємо як звичайно
            const child = spawn(scriptArgs[0], scriptArgs.slice(1), {
                cwd: __dirname,
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: true
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                if (code === 0) {
                    res.json({ output: stdout });
                } else {
                    res.status(500).json({ error: stderr || `Команда завершилася з кодом ${code}` });
                }
            });
        }

    } catch (error) {
        console.error('Помилка виконання команди:', error);
        res.status(500).json({ error: error.message });
    }
});

// Функція для послідовного виконання команд збірки
async function executeSequentialCommands(commands, res) {
    let output = '';
    let currentIndex = 0;

    function executeNext() {
        if (currentIndex >= commands.length) {
            res.json({ output });
            return;
        }

        const command = commands[currentIndex];
        const [cmd, ...args] = command.split(' ');

        const child = spawn(cmd, args, {
            cwd: __dirname,
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: true
        });

        child.stdout.on('data', (data) => {
            output += data.toString();
        });

        child.stderr.on('data', (data) => {
            output += data.toString();
        });

        child.on('close', (code) => {
            if (code !== 0) {
                res.status(500).json({ error: `Команда "${command}" завершилася з кодом ${code}\n${output}` });
                return;
            }

            currentIndex++;
            executeNext();
        });
    }

    executeNext();
}

app.listen(PORT, () => {
    console.log(`Сервер запущено на http://localhost:${PORT}`);
});