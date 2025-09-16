// MOVA Integrated Development Environment
// Цей скрипт виконується в браузері та забезпечує повний UI для роботи з MOVA

class MOVAUI {
    constructor() {
        this.lexicons = {};
        this.allowlists = {};
        this.currentLanguage = 'ua';
        this.activeTab = 'editor';
        this.activeFile = null;
        this.executionProcess = null;
    }

    async init() {
        await this.loadResources();
        this.setupTabs();
        this.setupEditor();
        this.setupBlanksManager();
        this.setupVNLParser();
        this.setupPlanRunner();
        this.setupValidation();
        this.setupLexiconManager();
        this.setupBuildSystem();
    }

    async loadResources() {
        const languages = ['ua', 'de', 'fr', 'pl'];

        try {
            const loadPromises = languages.flatMap(lang => [
                fetch(`/lexicon_${lang}.json`).then(res => res.json()).then(data => {
                    this.lexicons[lang] = data;
                }).catch(() => {
                    console.warn(`Не вдалося завантажити lexicon_${lang}.json`);
                    this.lexicons[lang] = {};
                }),
                fetch(`/allowlist_structural${lang === 'ua' ? '' : '_' + lang}.json`)
                    .then(res => res.json())
                    .then(data => {
                        this.allowlists[lang] = new Set(data);
                    }).catch(() => {
                        console.warn(`Не вдалося завантажити allowlist для ${lang}`);
                        this.allowlists[lang] = new Set();
                    })
            ]);

            await Promise.all(loadPromises);

            // Встановлюємо поточну мову
            this.currentLanguage = 'ua';

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
        const langInput = document.getElementById('lang-input');
        const canonicalOutput = document.getElementById('canonical-output');
        const saveButton = document.getElementById('save-button');
        const translateButton = document.getElementById('translate-button');
        const fileListElement = document.getElementById('file-list');
        const languageSelect = document.getElementById('language-select');
        const inputLanguageTitle = document.getElementById('input-language-title');

        const languageNames = {
            'ua': 'Український',
            'de': 'Німецький',
            'fr': 'Французький',
            'pl': 'Польський'
        };

        const handleTranslation = () => {
            const langJsonText = langInput.value;
            if (langJsonText.trim() === '') {
                canonicalOutput.value = '';
                return;
            }

            try {
                const langJson = JSON.parse(langJsonText);
                const canonicalJson = this.translateObject(langJson, this.currentLanguage);
                canonicalOutput.value = JSON.stringify(canonicalJson, null, 2);
            } catch (error) {
                canonicalOutput.value = `Помилка парсингу або трансляції:\n${error.message}`;
            }
        };

        const handleLanguageChange = () => {
            this.currentLanguage = languageSelect.value;
            inputLanguageTitle.textContent = `${languageNames[this.currentLanguage]} шаблон (вхід)`;

            // Оновлюємо список файлів
            this.loadFileList(fileListElement, `templates/${this.currentLanguage}`, (filename) => {
                this.loadFile(filename, langInput, fileListElement, `templates/${this.currentLanguage}`);
            });

            // Очищаємо активний файл
            this.activeFile = null;
            saveButton.disabled = true;
            fileListElement.querySelectorAll('li.active').forEach(li => li.classList.remove('active'));
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
                        content: langInput.value,
                        language: this.currentLanguage
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

        const translateFile = async () => {
            if (!this.activeFile) {
                alert('Немає активного файлу для перекладу.');
                return;
            }

            translateButton.disabled = true;
            translateButton.textContent = 'Переклад...';

            try {
                const response = await fetch('/api/translate-file', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename: this.activeFile,
                        language: this.currentLanguage
                    }),
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'Невідома помилка сервера');
                }

                canonicalOutput.value = JSON.stringify(result.canonical, null, 2);
                alert('Файл успішно перекладено!');

            } catch (error) {
                console.error('Помилка перекладу:', error);
                alert(`Не вдалося перекласти файл: ${error.message}`);
            } finally {
                translateButton.disabled = false;
                translateButton.textContent = 'Перекласти';
            }
        };

        langInput.addEventListener('input', handleTranslation);
        languageSelect.addEventListener('change', handleLanguageChange);
        saveButton.addEventListener('click', saveFile);
        translateButton.addEventListener('click', translateFile);

        // Завантажуємо початковий список файлів
        handleLanguageChange();

        // Handle paste
        langInput.addEventListener('paste', () => {
            setTimeout(() => {
                this.activeFile = null;
                saveButton.disabled = true;
                fileListElement.querySelectorAll('li.active').forEach(li => li.classList.remove('active'));
                handleTranslation();
            }, 0);
        });
    }

    // === BLANKS TAB ===
    setupBlanksManager() {
        const blankList = document.getElementById('blank-list');
        const blankContent = document.getElementById('blank-content');
        const loadBlankButton = document.getElementById('load-blank-button');
        const scaffoldButton = document.getElementById('scaffold-button');
        const scaffoldParams = document.getElementById('scaffold-params');
        const scaffoldResult = document.getElementById('scaffold-result');
        const blankLanguageSelect = document.getElementById('blank-language-select');
        const blankTitle = document.getElementById('blank-title');

        let currentBlank = null;
        let currentBlankLanguage = 'ua';

        const languageNames = {
            'ua': 'Український',
            'de': 'Німецький',
            'fr': 'Французький',
            'pl': 'Польський'
        };

        const handleBlankLanguageChange = () => {
            currentBlankLanguage = blankLanguageSelect.value;
            blankTitle.textContent = `${languageNames[currentBlankLanguage]} бланк`;

            // Оновлюємо список бланків
            this.loadFileList(blankList, `templates/blank/${currentBlankLanguage}`, (filename) => {
                this.loadBlank(filename);
            });

            // Очищаємо активний бланк
            currentBlank = null;
            blankContent.value = '';
            scaffoldParams.innerHTML = '';
            scaffoldResult.value = '';
        };

        const loadBlank = async (filename) => {
            try {
                const response = await fetch(`/templates/blank/${currentBlankLanguage}/${filename}`);
                if (!response.ok) throw new Error(`Не вдалося завантажити бланк ${filename}`);

                const content = await response.text();
                blankContent.value = content;
                currentBlank = filename;

                blankList.querySelectorAll('li').forEach(li => {
                    li.classList.toggle('active', li.dataset.filename === filename);
                });

                // Парсимо плейсхолдери для форми підстановки
                this.parsePlaceholders(content);

            } catch (error) {
                console.error('Помилка завантаження бланка:', error);
                alert(`Помилка завантаження бланка: ${error.message}`);
            }
        };

        const parsePlaceholders = (content) => {
            const placeholderRegex = /<([^>]+)>/g;
            const placeholders = [];
            let match;

            while ((match = placeholderRegex.exec(content)) !== null) {
                placeholders.push(match[1]);
            }

            scaffoldParams.innerHTML = '';

            if (placeholders.length > 0) {
                placeholders.forEach(placeholder => {
                    const div = document.createElement('div');
                    div.className = 'form-group';
                    div.innerHTML = `
                        <label for="param-${placeholder}">${placeholder}:</label>
                        <input type="text" id="param-${placeholder}" placeholder="Введіть значення для ${placeholder}">
                    `;
                    scaffoldParams.appendChild(div);
                });
            }
        };

        const scaffoldBlank = async () => {
            if (!currentBlank) {
                alert('Виберіть бланк для підстановки.');
                return;
            }

            const params = {};
            scaffoldParams.querySelectorAll('input').forEach(input => {
                const key = input.id.replace('param-', '');
                const value = input.value.trim();
                if (value) {
                    params[key] = value;
                }
            });

            if (Object.keys(params).length === 0) {
                alert('Введіть хоча б одне значення для підстановки.');
                return;
            }

            scaffoldButton.disabled = true;
            scaffoldButton.textContent = 'Обробка...';

            try {
                const response = await fetch('/api/scaffold', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        blankPath: `templates/blank/${currentBlankLanguage}/${currentBlank}`,
                        outputPath: `templates/${currentBlankLanguage}/${currentBlank.replace('_blank', '_filled')}`,
                        params: params
                    }),
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'Невідома помилка сервера');
                }

                scaffoldResult.value = JSON.stringify(result.content, null, 2);
                alert('Бланк успішно оброблено!');

            } catch (error) {
                console.error('Помилка обробки бланка:', error);
                alert(`Не вдалося обробити бланк: ${error.message}`);
            } finally {
                scaffoldButton.disabled = false;
                scaffoldButton.textContent = 'Створити шаблон';
            }
        };

        blankLanguageSelect.addEventListener('change', handleBlankLanguageChange);
        loadBlankButton.addEventListener('click', () => {
            if (currentBlank) {
                loadBlank(currentBlank);
            }
        });
        scaffoldButton.addEventListener('click', scaffoldBlank);

        // Завантажуємо початковий список бланків
        handleBlankLanguageChange();
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

        let currentLexiconLang = 'uk';

        const loadLexicon = async (lang = currentLexiconLang) => {
            try {
                const [lexRes, allowRes] = await Promise.all([
                    fetch(`/lexicon_${lang}.json`),
                    fetch(`/allowlist_structural${lang === 'ua' ? '' : '_' + lang}.json`)
                ]);

                if (lexRes.ok) {
                    const lexiconData = await lexRes.json();
                    lexiconArea.value = JSON.stringify(lexiconData, null, 2);
                } else {
                    lexiconArea.value = `Не вдалося завантажити lexicon_${lang}.json`;
                }

                if (allowRes.ok) {
                    const allowlistData = await allowRes.json();
                    allowlistArea.value = JSON.stringify(allowlistData, null, 2);
                } else {
                    allowlistArea.value = `Не вдалося завантажити allowlist для ${lang}`;
                }

            } catch (error) {
                console.error('Помилка завантаження лексикону:', error);
                alert(`Не вдалося завантажити лексикон: ${error.message}`);
            }
        };

        reloadBtn.addEventListener('click', () => loadLexicon());
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
        const buildKeysBtn = document.getElementById('build-keys-btn');
        const checkLexiconBtn = document.getElementById('check-lexicon-btn');

        // Трансляція
        const translateUaBtn = document.getElementById('translate-ua-btn');
        const translateDeBtn = document.getElementById('translate-de-btn');
        const translateFrBtn = document.getElementById('translate-fr-btn');
        const translatePlBtn = document.getElementById('translate-pl-btn');

        // Лінтинг
        const lintUaBtn = document.getElementById('lint-ua-btn');
        const lintDeBtn = document.getElementById('lint-de-btn');
        const lintFrBtn = document.getElementById('lint-fr-btn');
        const lintPlBtn = document.getElementById('lint-pl-btn');

        // Валідація
        const validateCanonicalBtn = document.getElementById('validate-canonical-btn');

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

        // Основні команди
        buildAllBtn.addEventListener('click', () => runCommand('npm run build:all', 'Повна збірка (всі мови)'));
        buildKeysBtn.addEventListener('click', () => runCommand('npm run build:keys', 'Збірка ключів'));
        checkLexiconBtn.addEventListener('click', () => runCommand('npm run check:lexicon', 'Перевірка лексикону'));

        // Трансляція
        translateUaBtn.addEventListener('click', () => runCommand('npm run translate:ua', 'Переклад UA'));
        translateDeBtn.addEventListener('click', () => runCommand('npm run translate:de', 'Переклад DE'));
        translateFrBtn.addEventListener('click', () => runCommand('npm run translate:fr', 'Переклад FR'));
        translatePlBtn.addEventListener('click', () => runCommand('npm run translate:pl', 'Переклад PL'));

        // Лінтинг
        lintUaBtn.addEventListener('click', () => runCommand('npm run lint:ua', 'Лінт UA'));
        lintDeBtn.addEventListener('click', () => runCommand('npm run lint:de', 'Лінт DE'));
        lintFrBtn.addEventListener('click', () => runCommand('npm run lint:fr', 'Лінт FR'));
        lintPlBtn.addEventListener('click', () => runCommand('npm run lint:pl', 'Лінт PL'));

        // Валідація
        validateCanonicalBtn.addEventListener('click', () => runCommand('npm run validate:canonical', 'Валідація канонічних файлів'));
    }

    // === UTILITY METHODS ===
    translateObject(obj, language = this.currentLanguage) {
        if (Array.isArray(obj)) {
            return obj.map(item => this.translateObject(item, language));
        }
        if (obj !== null && typeof obj === 'object') {
            const newObj = {};
            const lexicon = this.lexicons[language] || {};
            const allowlist = this.allowlists[language] || new Set();

            for (const key in obj) {
                const translatedKey = allowlist.has(key) ? (lexicon[key] || key) : key;
                let value = this.translateObject(obj[key], language);

                if (translatedKey === 'type' && typeof value === 'string' && allowlist.has(value)) {
                    value = lexicon[value] || value;
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

            // Автоматично перекладаємо, якщо це редактор
            if (textarea.id === 'lang-input') {
                setTimeout(() => {
                    const event = new Event('input');
                    textarea.dispatchEvent(event);
                }, 100);
            }

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