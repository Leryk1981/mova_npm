// MOVA Integrated Development Environment
// Цей скрипт виконується в браузері та забезпечує повний UI для роботи з MOVA

class MOVAUI {
    constructor() {
        this.lexicon = null;
        this.allowlist = null;
        this.activeTab = 'editor';
        this.activeFile = null;
        this.executionProcess = null;
    }

    async init() {
        await this.loadResources();
        this.setupTabs();
        this.setupEditor();
        this.setupVNLParser();
        this.setupPlanRunner();
        this.setupValidation();
        this.setupLexiconManager();
        this.setupBuildSystem();
    }

    async loadResources() {
        try {
            const [lexiconRes, allowlistRes] = await Promise.all([
                fetch('/lexicon_uk.json'),
                fetch('/allowlist_structural.json')
            ]);

            if (!lexiconRes.ok) throw new Error('Не вдалося завантажити lexicon_uk.json');
            if (!allowlistRes.ok) throw new Error('Не вдалося завантажити allowlist_structural.json');

            this.lexicon = await lexiconRes.json();
            const allowlistArray = await allowlistRes.json();
            this.allowlist = new Set(allowlistArray);

        } catch (error) {
            console.error("Помилка завантаження словників:", error);
            alert(`Не вдалося завантажити дані для трансляції. Перевірте консоль. ${error.message}`);
            return;
        }
    }

    setupTabs() {
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.dataset.tab);
            });
        });
    }

    switchTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.container').forEach(container => {
            container.classList.add('hidden');
        });

        // Remove active class from all tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });

        // Show selected tab
        document.getElementById(`${tabName}-tab`).classList.remove('hidden');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        this.activeTab = tabName;
    }

    // === EDITOR TAB ===
    setupEditor() {
        const ukInput = document.getElementById('uk-input');
        const enOutput = document.getElementById('en-output');
        const saveButton = document.getElementById('save-button');
        const fileListElement = document.getElementById('file-list');

        const handleTranslation = () => {
            const ukJsonText = ukInput.value;
            if (ukJsonText.trim() === '') {
                enOutput.value = '';
                return;
            }

            try {
                const ukJson = JSON.parse(ukJsonText);
                const enJson = this.translateObject(ukJson);
                enOutput.value = JSON.stringify(enJson, null, 2);
            } catch (error) {
                enOutput.value = `Помилка парсингу або трансляції:\n${error.message}`;
            }
        };

        const saveFile = async () => {
            if (!this.activeFile) {
                alert('Немає активного файлу для збереження.');
                return;
            }

            saveButton.disabled = true;
            saveButton.textContent = 'Збереження...';

            try {
                const response = await fetch('/api/save-template', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename: this.activeFile,
                        content: ukInput.value,
                    }),
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.message || 'Невідома помилка сервера');
                }

                alert(result.message);

            } catch (error) {
                console.error('Помилка збереження:', error);
                alert(`Не вдалося зберегти файл: ${error.message}`);
            } finally {
                saveButton.disabled = false;
                saveButton.textContent = 'Зберегти';
            }
        };

        ukInput.addEventListener('input', handleTranslation);
        saveButton.addEventListener('click', saveFile);

        // Load file list
        this.loadFileList(fileListElement, 'templates/ua', (filename) => {
            this.loadFile(filename, ukInput, fileListElement, 'uk-input');
        });

        // Handle paste
        ukInput.addEventListener('paste', () => {
            setTimeout(() => {
                this.activeFile = null;
                saveButton.disabled = true;
                fileListElement.querySelectorAll('li.active').forEach(li => li.classList.remove('active'));
                handleTranslation();
            }, 0);
        });
    }

    // === VNL PARSER TAB ===
    setupVNLParser() {
        const parseBtn = document.getElementById('parse-vnl-btn');
        const vnlInput = document.getElementById('vnl-input');
        const astOutput = document.getElementById('vnl-ast');
        const planOutput = document.getElementById('vnl-plan');

        parseBtn.addEventListener('click', async () => {
            const sentence = vnlInput.value.trim();
            if (!sentence) {
                alert('Введіть речення для парсингу');
                return;
            }

            parseBtn.disabled = true;
            parseBtn.textContent = 'Парсинг...';

            try {
                // Викликаємо CLI команду через API (потрібно додати до сервера)
                const response = await fetch('/api/parse-vnl', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sentence })
                });

                const result = await response.json();

                if (response.ok) {
                    astOutput.value = JSON.stringify(result.ast, null, 2);
                    planOutput.value = JSON.stringify(result.plan, null, 2);
                } else {
                    throw new Error(result.error);
                }

            } catch (error) {
                console.error('Помилка парсингу VNL:', error);
                astOutput.value = `Помилка: ${error.message}`;
                planOutput.value = '';
            } finally {
                parseBtn.disabled = false;
                parseBtn.textContent = 'Парсити';
            }
        });
    }

    // === PLAN RUNNER TAB ===
    setupPlanRunner() {
        const planList = document.getElementById('plan-list');
        const planContent = document.getElementById('plan-content');
        const runBtn = document.getElementById('run-plan-btn');
        const stopBtn = document.getElementById('stop-plan-btn');
        const logArea = document.getElementById('execution-log');

        this.loadFileList(planList, 'canonical', (filename) => {
            this.loadFile(filename, planContent, planList, 'canonical');
        });

        runBtn.addEventListener('click', async () => {
            const planText = planContent.value.trim();
            if (!planText) {
                alert('Виберіть план для виконання');
                return;
            }

            runBtn.disabled = true;
            stopBtn.disabled = false;
            logArea.textContent = '🚀 Початок виконання плану...\n';

            try {
                const response = await fetch('/api/run-plan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ plan: planText })
                });

                const result = await response.json();

                if (response.ok) {
                    logArea.textContent += '✅ План виконано успішно\n';
                    if (result.output) {
                        logArea.textContent += `Результат: ${JSON.stringify(result.output, null, 2)}\n`;
                    }
                } else {
                    throw new Error(result.error);
                }

            } catch (error) {
                console.error('Помилка виконання плану:', error);
                logArea.textContent += `❌ Помилка: ${error.message}\n`;
            } finally {
                runBtn.disabled = false;
                stopBtn.disabled = true;
            }
        });

        stopBtn.addEventListener('click', () => {
            if (this.executionProcess) {
                // Логіка зупинки процесу
                logArea.textContent += '🛑 Виконання зупинено користувачем\n';
                runBtn.disabled = false;
                stopBtn.disabled = true;
            }
        });
    }

    // === VALIDATION TAB ===
    setupValidation() {
        const validateBtn = document.getElementById('validate-btn');
        const inputArea = document.getElementById('validation-input');
        const resultsArea = document.getElementById('validation-results');
        const statusArea = document.getElementById('validation-status');

        validateBtn.addEventListener('click', async () => {
            const jsonText = inputArea.value.trim();
            if (!jsonText) {
                alert('Введіть JSON для валідації');
                return;
            }

            validateBtn.disabled = true;
            validateBtn.textContent = 'Валідація...';
            resultsArea.innerHTML = '';
            statusArea.innerHTML = '';

            try {
                const response = await fetch('/api/validate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ json: jsonText })
                });

                const result = await response.json();

                if (response.ok) {
                    statusArea.innerHTML = '<div class="status success">✅ Валідація пройшла успішно</div>';
                    resultsArea.textContent = 'Файл відповідає схемі JSON Schema';
                } else {
                    statusArea.innerHTML = '<div class="status error">❌ Помилки валідації</div>';
                    resultsArea.textContent = result.errors.join('\n');
                }

            } catch (error) {
                console.error('Помилка валідації:', error);
                statusArea.innerHTML = '<div class="status error">❌ Помилка валідації</div>';
                resultsArea.textContent = error.message;
            } finally {
                validateBtn.disabled = false;
                validateBtn.textContent = 'Валідувати';
            }
        });
    }

    // === LEXICON TAB ===
    setupLexiconManager() {
        const lexiconArea = document.getElementById('lexicon-content');
        const allowlistArea = document.getElementById('allowlist-content');
        const reloadBtn = document.getElementById('reload-lexicon-btn');
        const saveBtn = document.getElementById('save-lexicon-btn');

        const loadLexicon = async () => {
            try {
                const [lexRes, allowRes] = await Promise.all([
                    fetch('/lexicon_uk.json'),
                    fetch('/allowlist_structural.json')
                ]);

                lexiconArea.value = JSON.stringify(await lexRes.json(), null, 2);
                allowlistArea.value = JSON.stringify(await allowRes.json(), null, 2);

            } catch (error) {
                console.error('Помилка завантаження лексикону:', error);
                alert(`Не вдалося завантажити лексикон: ${error.message}`);
            }
        };

        reloadBtn.addEventListener('click', loadLexicon);
        saveBtn.addEventListener('click', async () => {
            try {
                const lexiconData = JSON.parse(lexiconArea.value);
                const allowlistData = JSON.parse(allowlistArea.value);

                // Тут потрібно додати API для збереження лексикону
                alert('Збереження лексикону поки не реалізовано в API');

            } catch (error) {
                alert(`Помилка збереження: ${error.message}`);
            }
        });

        loadLexicon();
    }

    // === BUILD TAB ===
    setupBuildSystem() {
        const buildAllBtn = document.getElementById('build-all-btn');
        const translateBtn = document.getElementById('translate-btn');
        const validateAllBtn = document.getElementById('validate-all-btn');
        const buildManifestBtn = document.getElementById('build-manifest-btn');
        const checkLexiconBtn = document.getElementById('check-lexicon-btn');
        const buildLog = document.getElementById('build-log');
        const buildStatus = document.getElementById('build-status');

        const runCommand = async (command, description) => {
            buildLog.textContent += `🚀 ${description}...\n`;
            buildStatus.innerHTML = '<div class="status warning">⚡ Виконується...</div>';

            try {
                const response = await fetch('/api/run-command', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ command })
                });

                const result = await response.json();

                if (response.ok) {
                    buildLog.textContent += `✅ ${description} завершено\n`;
                    if (result.output) {
                        buildLog.textContent += `${result.output}\n`;
                    }
                    buildStatus.innerHTML = '<div class="status success">✅ Завершено успішно</div>';
                } else {
                    throw new Error(result.error);
                }

            } catch (error) {
                console.error(`Помилка виконання ${command}:`, error);
                buildLog.textContent += `❌ Помилка: ${error.message}\n`;
                buildStatus.innerHTML = '<div class="status error">❌ Помилка виконання</div>';
            }
        };

        buildAllBtn.addEventListener('click', () => runCommand('npm run build', 'Повна збірка'));
        translateBtn.addEventListener('click', () => runCommand('npm run translate', 'Переклад на англійський'));
        validateAllBtn.addEventListener('click', () => runCommand('npm run validate', 'Валідація всіх файлів'));
        buildManifestBtn.addEventListener('click', () => runCommand('npm run build:manifest', 'Збірка маніфесту'));
        checkLexiconBtn.addEventListener('click', () => runCommand('npm run check:lexicon', 'Перевірка лексикону'));
    }

    // === UTILITY METHODS ===
    translateObject(obj) {
        if (Array.isArray(obj)) {
            return obj.map(item => this.translateObject(item));
        }
        if (obj !== null && typeof obj === 'object') {
            const newObj = {};
            for (const key in obj) {
                const translatedKey = this.allowlist.has(key) ? (this.lexicon[key] || key) : key;
                let value = this.translateObject(obj[key]);

                if (translatedKey === 'type' && typeof value === 'string') {
                    value = this.lexicon[value] || value;
                }

                newObj[translatedKey] = value;
            }
            return newObj;
        }
        return obj;
    }

    async loadFileList(listElement, path, onSelect) {
        try {
            const response = await fetch(`/api/files?path=${path}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const files = await response.json();

            listElement.innerHTML = '';
            files.sort().forEach(file => {
                const li = document.createElement('li');
                li.textContent = file;
                li.dataset.filename = file;
                li.addEventListener('click', () => onSelect(file));
                listElement.appendChild(li);
            });
        } catch (error) {
            console.error('Помилка завантаження списку файлів:', error);
            listElement.innerHTML = `<li>Помилка: ${error.message}</li>`;
        }
    }

    async loadFile(filename, textarea, listElement, basePath = 'templates/ua') {
        try {
            const response = await fetch(`/${basePath}/${filename}`);
            if (!response.ok) throw new Error(`Не вдалося завантажити файл ${filename}`);

            const content = await response.text();
            textarea.value = content;

            this.activeFile = filename;

            listElement.querySelectorAll('li').forEach(li => {
                li.classList.toggle('active', li.dataset.filename === filename);
            });

        } catch (error) {
            console.error('Помилка завантаження файлу:', error);
            alert(`Помилка завантаження файлу: ${error.message}`);
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    const movaUI = new MOVAUI();
    movaUI.init();
});