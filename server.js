import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import os from 'os';
import { spawn } from 'child_process';

const builderFormIdPattern = /^[a-z0-9_]+$/;

// Оскільки ми використовуємо ES Modules, __dirname не доступний.
// Це стандартний спосіб отримати шлях до поточної директорії.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 3000);

// Директорія з визначеннями форм для UI, як описано в ТЗ (tz_ui.md)
const FORM_DEFS_DIR = path.join(__dirname, 'form_definitions');
const FORMS_ROOT = path.join(__dirname, 'templates', 'forms');
const MARKETPLACE_ROOT = path.join(__dirname, 'marketplace');
const MARKETPLACE_PACKAGES_DIR = path.join(MARKETPLACE_ROOT, 'packages');
const MARKETPLACE_INDEX_PATH = path.join(MARKETPLACE_ROOT, 'index.json');
const MARKETPLACE_INSTALLED_DIR = path.join(MARKETPLACE_ROOT, 'installed');
const OUT_DIR = path.join(__dirname, 'out');

const installedPackages = new Map();

async function ensureDir(target) {
  await fs.mkdir(target, { recursive: true });
}

async function readJsonFile(filePath) {
  const data = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(data);
}

async function writeJsonFile(filePath, data) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function loadMarketplaceIndex() {
  try {
    return await readJsonFile(MARKETPLACE_INDEX_PATH);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function readMarketplacePackage(id, version) {
  const fileName = `${id}-${version}.zip`;
  const packagePath = path.join(MARKETPLACE_PACKAGES_DIR, fileName);
  const packageJson = await readJsonFile(packagePath);
  return packageJson;
}

async function extractMarketplacePackage(manifest, files) {
  const targetDir = path.join(MARKETPLACE_INSTALLED_DIR, `${manifest.id}-${manifest.version}`);
  for (const [relativePath, content] of Object.entries(files || {})) {
    const resolvedPath = path.join(targetDir, relativePath);
    await ensureDir(path.dirname(resolvedPath));
    await fs.writeFile(resolvedPath, content);
  }
  return targetDir;
}

// --- Middleware ---
app.use(cors()); // Дозволяємо крос-доменні запити
app.use(express.json());

// TODO: Додати CSRF protection middleware для POST/PUT/DELETE запитів
// TODO: Додати rate-limiting middleware для /api/run, /api/validate

// Сервіруємо статичні файли фронтенду (зібраний SPA)
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true }));

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

app.post('/api/builder/preview', async (req, res) => {
    try {
        const { envelope, formSpec } = req.body || {};
        if (envelope) {
            const version = (envelope.mova_version || '').toString();
            if (!/^3\.3\./.test(version)) {
                return res.status(422).json({ error: { code: 'ENVELOPE_VERSION_UNSUPPORTED', message: 'Підтримуються лише mova_version 3.3.x.' } });
            }
            return res.json({ ok: true, envelope });
        }

        if (formSpec?.id) {
            const [pkgId] = formSpec.id.split(':');
            const isInstalled = Array.from(installedPackages.keys()).some(key => key.startsWith(`${pkgId}@`));
            if (!isInstalled) {
                return res.status(422).json({ error: { code: 'PACKAGE_NOT_INSTALLED', message: 'Пакет не встановлено.' } });
            }
            return res.json({ ok: true });
        }

        return res.status(400).json({ error: { code: 'PREVIEW_INVALID', message: 'Необхідно надати envelope або formSpec.' } });
    } catch (error) {
        console.error('Builder preview failed:', error);
        res.status(500).json({ error: { code: 'PREVIEW_FAILED', message: 'Не вдалося згенерувати попередній перегляд.' } });
    }
});

app.post('/api/builder/save', async (req, res) => {
    const { formSpec } = req.body || {};
    if (!formSpec || typeof formSpec.id !== 'string' || !builderFormIdPattern.test(formSpec.id)) {
        return res.status(422).json({ error: { code: 'FORMSPEC_INVALID', message: 'Неприпустимий ідентифікатор форми.' } });
    }

    try {
        const targetDir = path.join(FORMS_ROOT, formSpec.id);
        const targetFile = path.join(targetDir, 'template.form.json');
        await writeJsonFile(targetFile, formSpec);
        const relativePath = path.posix.join('templates', 'forms', formSpec.id, 'template.form.json');
        res.json({ ok: true, id: formSpec.id, path: relativePath });
    } catch (error) {
        console.error('Builder save failed:', error);
        res.status(500).json({ error: { code: 'SAVE_FAILED', message: 'Не вдалося зберегти форму.' } });
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

app.get('/api/market/list', async (_req, res) => {
    try {
        const items = await loadMarketplaceIndex();
        const enriched = items.map(item => ({
            ...item,
            installed: Array.from(installedPackages.keys()).some(key => key.startsWith(`${item.id}@`))
        }));
        res.json(enriched);
    } catch (error) {
        console.error('Marketplace list failed:', error);
        res.status(500).json({ error: { code: 'MARKET_LIST_FAILED', message: 'Не вдалося отримати список пакунків.' } });
    }
});

app.post('/api/market/install', async (req, res) => {
    try {
        const { id, version } = req.body || {};
        if (!id || !version) {
            return res.status(400).json({ error: { code: 'MARKET_INVALID_REQUEST', message: 'Необхідні id та version.' } });
        }

        const key = `${id}@${version}`;
        if (installedPackages.has(key)) {
            return res.status(409).json({ error: { code: 'ALREADY_INSTALLED', message: 'Пакет вже встановлено.' } });
        }

        const index = await loadMarketplaceIndex();
        const manifest = index.find(item => item.id === id && item.version === version);
        if (!manifest) {
            return res.status(404).json({ error: { code: 'PACKAGE_NOT_FOUND', message: 'Пакет не знайдено.' } });
        }

        const pkg = await readMarketplacePackage(id, version);
        const targetDir = await extractMarketplacePackage(pkg.manifest, pkg.files);
        installedPackages.set(key, { manifest, targetDir });
        res.json({ installed: true });
    } catch (error) {
        console.error('Marketplace install failed:', error);
        res.status(500).json({ error: { code: 'INSTALL_FAILED', message: 'Не вдалося встановити пакет.' } });
    }
});

app.post('/api/webhook/proxy/echo_local', async (req, res) => {
    try {
        await ensureDir(OUT_DIR);
        const logPath = path.join(OUT_DIR, 'webhooks.ndjson');
        const record = { ts: new Date().toISOString(), body: req.body };
        await fs.appendFile(logPath, `${JSON.stringify(record)}\n`);
        res.json({ ok: true });
    } catch (error) {
        console.error('Proxy echo failed:', error);
        res.status(500).json({ error: { code: 'PROXY_FAILED', message: 'Не вдалося зберегти webhook.' } });
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

const httpServer = app.listen(port, () => console.log(`Server on :${port}`));

function shutdown() {
  console.log('Shutting down...');
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
