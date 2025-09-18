import express from 'express';
import builderController from './server/builder.controller.mjs';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import os from 'os';
import { spawn } from 'child_process';

// Оскільки ми використовуємо ES Modules, __dirname не доступний.
// Це стандартний спосіб отримати шлях до поточної директорії.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Директорія з визначеннями форм для UI, як описано в ТЗ (tz_ui.md)
const FORM_DEFS_DIR = path.join(__dirname, 'form_definitions');

// --- Middleware ---
app.use(cors()); // Дозволяємо крос-доменні запити
app.use(express.json());

app.use('/api/builder', builderController);

// TODO: Додати CSRF protection middleware для POST/PUT/DELETE запитів
// TODO: Додати rate-limiting middleware для /api/run, /api/validate

// Сервіруємо статичні файли фронтенду (зібраний SPA)
app.use(express.static(path.join(__dirname, 'public')));

// --- Допоміжна функція для запуску скриптів ---
const runScript = (scriptPath, args = [], options = {}) => {
    return new Promise((resolve, reject) => {
        const fullScriptPath = path.join(__dirname, scriptPath);
        const child = spawn('node', [fullScriptPath, ...args], {
            cwd: __dirname,
            ...options,
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data) => { stdout += data.toString(); });
        child.stderr?.on('data', (data) => { stderr += data.toString(); });

        child.on('close', (code) => {
            if (code === 0) {
                resolve({ stdout, stderr });
            } else {
                const error = new Error(`Script ${scriptPath} exited with code ${code}`);
                error.stdout = stdout;
                error.stderr = stderr;
                reject(error);
            }
        });

        child.on('error', (err) => {
            reject(err);
        });
    });
};

// --- API Endpoints згідно з tz_ui.md ---

// GET /api/templates — список метаданих шаблонів для галереї
app.get('/api/templates', async (req, res) => {
    try {
        await fs.access(FORM_DEFS_DIR);
        const files = await fs.readdir(FORM_DEFS_DIR);
        const formFiles = files.filter(file => file.endsWith('.form.json'));

        const templates = await Promise.all(formFiles.map(async (file) => {
            const filePath = path.join(FORM_DEFS_DIR, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const formDef = JSON.parse(content);
            const hasSecrets = formDef.sections.some(s => s.fields.some(f => f.type === 'secret-alias'));

            // Повертаємо тільки метадані, потрібні для галереї
            return {
                id: formDef.id,
                title: formDef.title,
                category: formDef.category,
                requiresSecrets: hasSecrets,
            };
        }));

        res.json(templates);
    } catch (error) {
        if (error.code === 'ENOENT') {
             console.warn(`Директорія з визначеннями форм не знайдена: ${FORM_DEFS_DIR}`);
             return res.json([]); // Повертаємо пустий масив, якщо директорії немає
        }
        console.error('Помилка при читанні шаблонів форм:', error);
        res.status(500).json({ message: 'Не вдалося завантажити список шаблонів.' });
    }
});

// GET /api/templates/:id — повна модель форми для майстра
app.get('/api/templates/:id', async (req, res) => {
    const { id } = req.params;

    // Валідація ID для уникнення path traversal
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
        return res.status(400).json({ message: 'Неприпустимий ID шаблону.' });
    }

    try {
        const filePath = path.join(FORM_DEFS_DIR, `${id}.form.json`);
        const content = await fs.readFile(filePath, 'utf-8');
        res.setHeader('Content-Type', 'application/json');
        res.send(content);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).json({ message: `Шаблон з ID '${id}' не знайдено.` });
        }
        console.error(`Помилка при читанні шаблону '${id}':`, error);
        res.status(500).json({ message: 'Не вдалося завантажити шаблон.' });
    }
});

// POST /api/build-canonical — збірка canonical з formSpec та formData
app.post('/api/build-canonical', async (req, res) => {
    const { formSpec, formValues, mode = 'dev', fillSample = false } = req.body;
    if (!formSpec || !formValues) {
        return res.status(400).json({ message: 'Необхідно надати formSpec та formValues.' });
    }

    let tempDir;
    try {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mova-build-'));
        const formFile = path.join(tempDir, 'form.json');
        const valuesFile = path.join(tempDir, 'values.json');
        const outDir = path.join(tempDir, 'canonical');

        await fs.writeFile(formFile, JSON.stringify(formSpec, null, 2), 'utf-8');
        await fs.writeFile(valuesFile, JSON.stringify(formValues, null, 2), 'utf-8');

        const args = [
            formFile,
            '--values',
            valuesFile,
            '--mode',
            mode === 'prod' ? 'prod' : 'dev',
            '--out-dir',
            outDir
        ];
        if (fillSample) {
            args.push('--fill-sample');
        }

        const { stdout, stderr } = await runScript('scripts/forms/build_canonical.mjs', args);
        console.log('Build stdout:', stdout);
        if (stderr) {
            console.warn('Build stderr:', stderr);
        }

        const outputFile = path.join(outDir, `${formSpec.id}.canonical.json`);
        const canonicalJson = JSON.parse(await fs.readFile(outputFile, 'utf-8'));
        res.json({ canonical: canonicalJson, logs: { stdout, stderr } });

    } catch (error) {
        console.error('Помилка під час build canonical:', error.stderr || error.message);
        res.status(500).json({ message: 'Не вдалося збудувати canonical.', error: error.stderr || error.message });
    } finally {
        if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
    }
});

// POST /api/translate — переклад UA-JSON в canonical
app.post('/api/translate', async (req, res) => {
    const { uaJson, lang = 'uk' } = req.body;
    if (!uaJson) {
        return res.status(400).json({ message: 'Необхідно надати uaJson.' });
    }

    let tempDir;
    try {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mova-translate-'));
        const inFile = path.join(tempDir, 'input.json');
        const outFile = path.join(tempDir, 'output.canonical.json');

        await fs.writeFile(inFile, JSON.stringify(uaJson, null, 2), 'utf-8');

        // Виклик: translate.mjs <input_file> --lang <lang> --out <output_file>
        // Передаємо відносні шляхи від projectRoot
        const relativeInFile = path.relative(__dirname, inFile);
        const relativeOutFile = path.relative(__dirname, outFile);
        console.log('Translate args:', [relativeInFile, `--lang=${lang}`, `--out=${relativeOutFile}`]);
        const { stdout, stderr } = await runScript('scripts/translation/translate.mjs', [relativeInFile, `--lang=${lang}`, `--out=${relativeOutFile}`]);
        console.log('Translate stdout:', stdout);
        console.log('Translate stderr:', stderr);

        const resultJson = await fs.readFile(outFile, 'utf-8');
        res.json(JSON.parse(resultJson));

    } catch(error) {
        console.error('Помилка під час перекладу в canonical:', error);
        res.status(500).json({ message: 'Не вдалося перекласти в canonical.', error: error.stderr || error.message });
    } finally {
        if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
    }
});

// POST /api/validate — валідація canonical JSON за схемами
app.post('/api/validate', async (req, res) => {
    const { canonicalJson } = req.body;
    if (!canonicalJson) {
        return res.status(400).json({ message: 'Необхідно надати canonicalJson.' });
    }

    let tempDir;
    try {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mova-validate-'));
        const tempFile = path.join(tempDir, 'validate.canonical.json');
        await fs.writeFile(tempFile, JSON.stringify(canonicalJson, null, 2), 'utf-8');

        // Припускаємо, що скрипт валідації може приймати шлях до файлу
        await runScript('scripts/validation/validate_schemas.mjs', [tempFile]);
        res.json({ valid: true, report: 'JSON валідний згідно зі схемами.' });
    } catch (error) {
        console.error('Помилка валідації:', error.stderr || error.message);
        res.status(400).json({ valid: false, report: error.stderr || 'Не вдалося виконати валідацію.' });
    } finally {
        if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
    }
});

// POST /api/run — виконання плану (dry-run/smoke)
app.post('/api/run', async (req, res) => {
    const { canonicalJson, dryRun = true } = req.body;
    if (!canonicalJson) {
        return res.status(400).json({ message: 'Необхідно надати canonicalJson.' });
    }

    let tempDir;
    try {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mova-run-'));
        const tempFile = path.join(tempDir, 'run.canonical.json');
        await fs.writeFile(tempFile, JSON.stringify(canonicalJson, null, 2), 'utf-8');

        const args = [tempFile];
        if (dryRun) {
            args.push('--dry-run'); // Припускаємо, що рантайм підтримує цей флаг
        }

        const { stdout, stderr } = await runScript('scripts/runtime/run_plan.mjs', args);
        res.json({ success: true, output: stdout, warnings: stderr });
    } catch (error) {
        console.error('Помилка виконання плану:', error.stderr || error.message);
        res.status(500).json({ success: false, error: error.stderr || 'Не вдалося виконати план.' });
    } finally {
        if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
    }
});

// GET /api/secrets — менеджер секретів (отримання списку alias'ів)
app.get('/api/secrets', async (req, res) => {
    // MOCK: В реальній системі тут буде логіка перевірки існування секретів у Vault/ENV
    res.json([
        { alias: 'SENDGRID_API_KEY', status: 'OK' },
        { alias: 'STRIPE_API_KEY', status: 'Absent' },
        { alias: 'SLACK_WEBHOOK_URL', status: 'OK' },
    ]);
});

// POST /api/secrets — менеджер секретів (додавання/оновлення alias'у)
app.post('/api/secrets', async (req, res) => {
    const { alias } = req.body;
    if (!alias) {
        return res.status(400).json({ message: 'Необхідно надати alias.' });
    }
    // MOCK: В реальній системі тут буде логіка збереження alias'у.
    // Значення секрету НЕ передається і не зберігається на цьому сервері.
    console.log(`Отримано запит на додавання/оновлення alias'у: ${alias}`);
    res.status(201).json({ message: `Alias '${alias}' успішно зареєстровано.` });
});

// --- Обробка 404 та перенаправлення на SPA ---
app.get('*', (req, res) => {
    // Для будь-якого GET-запиту, що не збігся з API або статикою,
    // повертаємо головний файл SPA для підтримки client-side routing.
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Сервер MOVA UI Gateway запущено на http://localhost:${PORT}`);
});
