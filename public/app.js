const { useState, useEffect, useMemo, useCallback } = React;

function App() {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [view, setView] = useState('gallery'); // 'gallery', 'form', 'secrets'
    const [selectedTemplateId, setSelectedTemplateId] = useState(null);
    const [formDef, setFormDef] = useState(null);
    const [secrets, setSecrets] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [history, setHistory] = useState(() => {
        const saved = localStorage.getItem('mova_history');
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        // Сервер запущено на порту 3001
        fetch('http://localhost:3001/api/templates')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Помилка мережі. Перевірте, чи запущено сервер.');
                }
                return response.json();
            })
            .then(data => {
                setTemplates(data);
                setLoading(false);
            })
            .catch(error => {
                setError(error.message);
                setLoading(false);
            });
    }, []); // Пустий масив залежностей означає, що ефект виконається один раз

    const handleSelectTemplate = async (templateId) => {
        try {
            const response = await fetch(`http://localhost:3001/api/templates/${templateId}`);
            if (!response.ok) {
                throw new Error('Не вдалося завантажити шаблон');
            }
            const data = await response.json();
            setFormDef(data);
            setSelectedTemplateId(templateId);
            setView('form');
        } catch (error) {
            alert(`Помилка: ${error.message}`);
        }
    };

    const handleBackToGallery = () => {
        setView('gallery');
        setSelectedTemplateId(null);
        setFormDef(null);
    };

    const handleShowSecrets = async () => {
        try {
            const response = await fetch('http://localhost:3001/api/secrets');
            if (!response.ok) throw new Error('Не вдалося завантажити секрети');
            const data = await response.json();
            setSecrets(data);
            setView('secrets');
        } catch (error) {
            alert(`Помилка: ${error.message}`);
        }
    };

    const handleAddSecret = async (alias) => {
        try {
            const response = await fetch('http://localhost:3001/api/secrets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alias })
            });
            if (!response.ok) throw new Error('Не вдалося додати секрет');
            await handleShowSecrets(); // Перезагрузить список
        } catch (error) {
            alert(`Помилка: ${error.message}`);
        }
    };

    const filteredTemplates = templates.filter(template => {
        const matchesSearch = template.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || template.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const categories = ['all', ...new Set(templates.map(t => t.category))];

    const addToHistory = (templateId, result) => {
        const entry = {
            id: Date.now(),
            templateId,
            templateTitle: templates.find(t => t.id === templateId)?.title || templateId,
            timestamp: new Date().toISOString(),
            result
        };
        const newHistory = [entry, ...history.slice(0, 9)]; // Keep last 10
        setHistory(newHistory);
        localStorage.setItem('mova_history', JSON.stringify(newHistory));
    };

    const handleShowHistory = () => {
        setView('history');
    };

    if (view === 'form' && formDef) {
        return (
            <div className="app-container">
                <header className="app-header">
                    <button onClick={handleBackToGallery} style={{ marginBottom: '1rem', padding: '0.5rem 1rem', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        ← Назад до галереї
                    </button>
                    <h1>{formDef.title}</h1>
                    <p>Заповніть форму для генерації плану</p>
                </header>
                <main>
                    <FormWizard formDef={formDef} onBack={handleBackToGallery} />
                </main>
            </div>
        );
    }

    if (view === 'secrets') {
        return (
            <div className="app-container">
                <header className="app-header">
                    <button onClick={handleBackToGallery} style={{ marginBottom: '1rem', padding: '0.5rem 1rem', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        ← Назад до галереї
                    </button>
                    <h1>Управління секретами</h1>
                    <p>Перегляньте та додайте alias'и для секретів</p>
                </header>
                <main>
                    <SecretsManager secrets={secrets} onAddSecret={handleAddSecret} />
                </main>
            </div>
        );
    }

    if (view === 'history') {
        return (
            <div className="app-container">
                <header className="app-header">
                    <button onClick={handleBackToGallery} style={{ marginBottom: '1rem', padding: '0.5rem 1rem', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        ← Назад до галереї
                    </button>
                    <h1>Історія запусків</h1>
                    <p>Останні генерації планів</p>
                </header>
                <main>
                    <History history={history} />
                </main>
            </div>
        );
    }

    return (
        <div className="app-container">
            <header className="app-header" role="banner">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div>
                        <h1>Галерея шаблонів MOVA</h1>
                        <p>Оберіть шаблон, щоб почати роботу</p>
                    </div>
                    <button
                        onClick={handleShowSecrets}
                        aria-label="Управління секретами"
                        style={{ padding: '0.5rem 1rem', backgroundColor: '#ffc107', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        Управління секретами
                    </button>
                </div>
                {!loading && !error && (
                    <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <input
                            type="text"
                            placeholder="Пошук шаблонів..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            aria-label="Пошук шаблонів"
                            style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', flex: 1 }}
                        />
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            aria-label="Фільтр за категоріями"
                            style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                        >
                            {categories.map(cat => (
                                <option key={cat} value={cat}>
                                    {cat === 'all' ? 'Всі категорії' : cat}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </header>
            <main id="main-content" role="main">
                {loading && <p>Завантаження шаблонів...</p>}
                {error && <p className="error-message">Помилка: {error}</p>}
                {!loading && !error && (
                    <div className="template-gallery">
                        {filteredTemplates.length > 0 ? (
                            filteredTemplates.map(template => (
                                <TemplateCard key={template.id} template={template} onSelect={() => handleSelectTemplate(template.id)} />
                            ))
                        ) : (
                            <p>Шаблони не знайдено. Спробуйте змінити фільтри.</p>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

function TemplateCard({ template, onSelect }) {
    const handleCardClick = () => {
        onSelect();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect();
        }
    };

    return (
        <div
            className="template-card"
            onClick={handleCardClick}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="button"
            aria-label={`Обрати шаблон ${template.title}`}
        >
            <h3>{template.title}</h3>
            <p className="category">{template.category}</p>
            {template.requiresSecrets && (
                <div className="secrets-badge" aria-label="Потребує секретів">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    <span>Потребує секретів</span>
                </div>
            )}
        </div>
    );
}

function SecretsManager({ secrets, onAddSecret }) {
    const [newAlias, setNewAlias] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (newAlias.trim()) {
            onAddSecret(newAlias.trim());
            setNewAlias('');
        }
    };

    return (
        <div>
            <h3>Існуючі секрети</h3>
            <ul style={{ listStyle: 'none', padding: 0 }}>
                {secrets.map(secret => (
                    <li key={secret.alias} style={{ padding: '0.5rem', border: '1px solid #e0e0e0', borderRadius: '4px', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{secret.alias}</span>
                        <span style={{ color: secret.status === 'OK' ? 'green' : 'red' }}>{secret.status}</span>
                    </li>
                ))}
            </ul>
            <h3>Додати новий alias</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <input
                    type="text"
                    value={newAlias}
                    onChange={(e) => setNewAlias(e.target.value)}
                    placeholder="Наприклад, MY_API_KEY"
                    style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', flex: 1 }}
                />
                <button type="submit" style={{ padding: '0.5rem 1rem', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    Додати
                </button>
            </form>
        </div>
    );
}

function History({ history }) {
    if (history.length === 0) {
        return <p>Історія порожня. Спробуйте згенерувати план.</p>;
    }

    return (
        <div>
            <ul style={{ listStyle: 'none', padding: 0 }}>
                {history.map(entry => (
                    <li key={entry.id} style={{ padding: '1rem', border: '1px solid #e0e0e0', borderRadius: '8px', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <h4 style={{ margin: 0 }}>{entry.templateTitle}</h4>
                            <small style={{ color: '#6c757d' }}>{new Date(entry.timestamp).toLocaleString()}</small>
                        </div>
                        <div style={{ marginBottom: '0.5rem' }}>
                            <strong>Результат:</strong> {entry.result.validateResult?.valid ? '✅ Валідний' : '❌ Невалідний'}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                onClick={() => {
                                    const blob = new Blob([JSON.stringify(entry.result.canonicalJson, null, 2)], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `${entry.templateId}.canonical.json`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                }}
                                style={{ padding: '0.25rem 0.5rem', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                            >
                                Canonical JSON
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function FormWizard({ formDef, onBack }) {
    const normalizedSections = useMemo(
        () => formDef.sections.map(section => ({
            ...section,
            fields: section.fields.map(field => ({
                ...field,
                label: formDef.i18n?.fields?.[field.key]?.uk || field.key
            }))
        })),
        [formDef]
    );

    const allFields = useMemo(() => normalizedSections.flatMap(section => section.fields), [normalizedSections]);
    const requiredFields = useMemo(() => allFields.filter(field => field.required), [allFields]);
    const optionalFields = useMemo(() => allFields.filter(field => !field.required), [allFields]);
    const secretFields = useMemo(() => allFields.filter(field => field.type === 'secret-alias'), [allFields]);

    const [formData, setFormData] = useState(() => {
        const saved = localStorage.getItem(`form_${formDef.id}`);
        return saved ? JSON.parse(saved) : {};
    });
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [wizardStep, setWizardStep] = useState('basic');
    const [errors, setErrors] = useState({});
    const [strictMode, setStrictMode] = useState(false);

    const getLabel = useCallback((key) => formDef.i18n?.fields?.[key]?.uk || key, [formDef]);

    useEffect(() => {
        localStorage.setItem(`form_${formDef.id}`, JSON.stringify(formData));
    }, [formData, formDef.id]);

    const isEmptyField = useCallback(
        (field, rawValue) => {
            const value = rawValue !== undefined ? rawValue : formData[field.key];
            if (value === undefined || value === null) return true;
            if (field.type === 'checkbox') return false;
            if (typeof value === 'string') return value.trim() === '';
            return false;
        },
        [formData]
    );

    const unresolvedRequired = useMemo(
        () => requiredFields.filter(field => isEmptyField(field, formData[field.key])),
        [requiredFields, isEmptyField, formData]
    );

    const validateField = useCallback(
        (field, overrideValue) => {
            const value = overrideValue !== undefined ? overrideValue : formData[field.key];
            if (field.required && isEmptyField(field, value)) {
                return 'Це поле обов\'язкове';
            }
            const stringValue = typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value);
            if (field.type === 'email' && stringValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(stringValue)) {
                return 'Неправильний формат email';
            }
            if (field.type === 'number' && stringValue && isNaN(Number(stringValue))) {
                return 'Має бути число';
            }
            const validators = field.validators || {};
            if (validators.pattern && stringValue) {
                try {
                    const regex = new RegExp(validators.pattern);
                    if (!regex.test(stringValue)) {
                        return 'Значення не відповідає формату';
                    }
                } catch (error) {
                    console.warn(`Некоректний pattern для поля ${field.key}:`, error);
                }
            }
            if (validators.min !== undefined && stringValue) {
                const num = Number(stringValue);
                if (!Number.isNaN(num) && num < validators.min) {
                    return `Мінімальне значення: ${validators.min}`;
                }
            }
            if (validators.max !== undefined && stringValue) {
                const num = Number(stringValue);
                if (!Number.isNaN(num) && num > validators.max) {
                    return `Максимальне значення: ${validators.max}`;
                }
            }
            return null;
        },
        [formData, isEmptyField]
    );

    const handleInputChange = useCallback(
        (key, rawValue) => {
            const field = allFields.find(f => f.key === key);
            const value = field?.type === 'checkbox' ? rawValue : rawValue;
            setFormData(prev => ({ ...prev, [key]: value }));
            if (field) {
                const error = validateField(field, value);
                setErrors(prev => ({ ...prev, [key]: error }));
            }
        },
        [allFields, validateField]
    );

    const handleFillSample = useCallback(() => {
        const nextData = { ...formData };
        const nextErrors = { ...errors };
        allFields.forEach(field => {
            if (field.sample !== undefined) {
                nextData[field.key] = field.sample;
                nextErrors[field.key] = validateField(field, field.sample);
            } else if (!Object.prototype.hasOwnProperty.call(nextData, field.key) && field.default !== undefined) {
                nextData[field.key] = field.default;
                nextErrors[field.key] = validateField(field, field.default);
            } else if (field.type === 'checkbox' && !Object.prototype.hasOwnProperty.call(nextData, field.key)) {
                nextData[field.key] = false;
                nextErrors[field.key] = null;
            }
        });
        setFormData(nextData);
        setErrors(nextErrors);
    }, [allFields, formData, errors, validateField]);

    const nextStep = () => {
        if (wizardStep === 'basic') setWizardStep('advanced');
        else if (wizardStep === 'advanced') setWizardStep('summary');
    };

    const prevStep = () => {
        if (wizardStep === 'advanced') setWizardStep('basic');
        else if (wizardStep === 'summary') setWizardStep('advanced');
    };

    const handleGenerate = async () => {
        const newErrors = { ...errors };
        requiredFields.forEach(field => {
            newErrors[field.key] = validateField(field, formData[field.key]);
        });
        setErrors(newErrors);

        if (strictMode && unresolvedRequired.length > 0) {
            alert(`Заповніть обов'язкові поля: ${unresolvedRequired.map(f => getLabel(f.key)).join(', ')}`);
            return;
        }

        setLoading(true);
        try {
            const buildResponse = await fetch('http://localhost:3001/api/build-canonical', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    formSpec: formDef,
                    formValues: formData,
                    mode: strictMode ? 'prod' : 'dev',
                    fillSample: false
                })
            });
            if (!buildResponse.ok) {
                const message = await buildResponse.text();
                throw new Error(message || 'Помилка build canonical');
            }
            const buildPayload = await buildResponse.json();
            const canonicalJson = buildPayload.canonical;
            const buildLogs = buildPayload.logs || { stdout: '', stderr: '' };

            const validateResponse = await fetch('http://localhost:3001/api/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ canonicalJson })
            });
            if (!validateResponse.ok) {
                const message = await validateResponse.text();
                throw new Error(message || 'Помилка validate');
            }
            const validateResult = await validateResponse.json();

            let secretsStatus = [];
            try {
                const secretsResponse = await fetch('http://localhost:3001/api/secrets');
                const available = secretsResponse.ok ? await secretsResponse.json() : [];
                secretsStatus = secretFields.map(field => {
                    const alias = formData[field.key] ?? field.sample ?? field.default ?? '';
                    const match = available.find(item => item.alias === alias);
                    const status = alias ? (match?.status || 'unknown') : 'не задано';
                    return {
                        fieldKey: field.key,
                        label: getLabel(field.key),
                        alias,
                        status
                    };
                });
            } catch (error) {
                console.warn('Не вдалося отримати статуси секретів:', error);
                secretsStatus = secretFields.map(field => ({
                    fieldKey: field.key,
                    label: getLabel(field.key),
                    alias: formData[field.key] ?? field.sample ?? field.default ?? '',
                    status: 'unknown'
                }));
            }

            setResult({
                canonicalJson,
                validateResult,
                logs: buildLogs,
                secretsStatus,
                runResult: null,
                activeTab: 'canonical'
            });
            setWizardStep('result');
        } catch (error) {
            alert(`Помилка: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleRunDry = async () => {
        if (!result?.canonicalJson) return;
        setLoading(true);
        try {
            const runResponse = await fetch('http://localhost:3001/api/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ canonicalJson: result.canonicalJson, dryRun: true })
            });
            const runResult = await runResponse.json();
            setResult(prev => ({ ...prev, runResult }));
        } catch (error) {
            alert(`Помилка запуску: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const downloadJson = (data, filename) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const renderField = (field) => {
        const hasValue = Object.prototype.hasOwnProperty.call(formData, field.key);
        const rawValue = hasValue ? formData[field.key] : field.default !== undefined ? field.default : field.type === 'checkbox' ? false : '';
        const value = field.type === 'checkbox' ? Boolean(rawValue) : rawValue ?? '';
        const error = errors[field.key];
        const placeholder = typeof field.sample === 'string' ? field.sample : field.placeholder || '';

        return (
            <div key={field.key} style={{ marginBottom: '1rem' }}>
                <label htmlFor={field.key} style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                    {field.label} {field.required && <span style={{ color: 'red' }}>*</span>}
                </label>
                {field.type === 'textarea' ? (
                    <textarea
                        id={field.key}
                        value={typeof value === 'string' ? value : ''}
                        onChange={(e) => handleInputChange(field.key, e.target.value)}
                        placeholder={placeholder}
                        rows={field.rows || 4}
                        style={{
                            width: '100%',
                            padding: '0.5rem',
                            border: `1px solid ${error ? '#dc3545' : '#ccc'}`,
                            borderRadius: '4px',
                            minHeight: '80px'
                        }}
                    />
                ) : field.type === 'checkbox' ? (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                            type="checkbox"
                            checked={value}
                            onChange={(e) => handleInputChange(field.key, e.target.checked)}
                        />
                        <span>{field.label}</span>
                    </label>
                ) : (
                    <input
                        id={field.key}
                        type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'text'}
                        value={typeof value === 'string' ? value : value ?? ''}
                        onChange={(e) => handleInputChange(field.key, e.target.value)}
                        placeholder={placeholder}
                        style={{
                            width: '100%',
                            padding: '0.5rem',
                            border: `1px solid ${error ? '#dc3545' : '#ccc'}`,
                            borderRadius: '4px'
                        }}
                    />
                )}
                {field.sample !== undefined && field.type !== 'checkbox' && (
                    <small style={{ color: '#6c757d', display: 'block', marginTop: '0.25rem' }}>
                        Приклад: {typeof field.sample === 'object' ? JSON.stringify(field.sample) : field.sample}
                    </small>
                )}
                {error && <small style={{ color: '#dc3545', marginTop: '0.25rem', display: 'block' }}>{error}</small>}
            </div>
        );
    };

    if (wizardStep === 'result' && result) {
        return (
            <div>
                <nav style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#6c757d' }}>
                    Шаблони → {formDef.title} → Результат
                </nav>
                <h2>Результат генерації</h2>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => downloadJson(result.canonicalJson, `${formDef.id}.canonical.json`)}
                        style={{ padding: '0.5rem 1rem', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        Завантажити Canonical JSON
                    </button>
                    <button
                        onClick={handleRunDry}
                        disabled={loading || result.runResult}
                        style={{ padding: '0.5rem 1rem', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        {loading ? 'Запуск...' : 'Dry-run'}
                    </button>
                    <button
                        onClick={() => setWizardStep('summary')}
                        style={{ padding: '0.5rem 1rem', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        Назад до підсумку
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #e0e0e0' }}>
                    {['canonical', 'validation', 'secrets'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setResult(prev => ({ ...prev, activeTab: tab }))}
                            style={{
                                padding: '0.5rem 1rem',
                                backgroundColor: result.activeTab === tab ? '#007bff' : 'transparent',
                                color: result.activeTab === tab ? 'white' : '#007bff',
                                border: 'none',
                                borderRadius: '4px 4px 0 0',
                                cursor: 'pointer'
                            }}
                        >
                            {tab === 'canonical' ? 'Canonical' : tab === 'validation' ? 'Валідація' : 'Секрети'}
                        </button>
                    ))}
                </div>
                <div style={{ padding: '1rem', border: '1px solid #e0e0e0', borderTop: 'none', minHeight: '320px' }}>
                    {result.activeTab === 'canonical' && (
                        <pre style={{ overflow: 'auto' }}>{JSON.stringify(result.canonicalJson, null, 2)}</pre>
                    )}
                    {result.activeTab === 'validation' && (
                        <div>
                            <h3>Валідація: {result.validateResult.valid ? '✅ Валідний' : '❌ Невалідний'}</h3>
                            <p>{result.validateResult.report}</p>
                            {(result.logs?.stdout || result.logs?.stderr) && (
                                <div style={{ marginTop: '1.5rem' }}>
                                    <h4>Логи builder'а</h4>
                                    {result.logs.stdout && (
                                        <pre style={{ background: '#f8f9fa', padding: '0.5rem', overflow: 'auto' }}>{result.logs.stdout.trim() || '(порожньо)'}</pre>
                                    )}
                                    {result.logs.stderr && (
                                        <pre style={{ background: '#fff4f4', padding: '0.5rem', overflow: 'auto', color: '#dc3545' }}>{result.logs.stderr.trim()}</pre>
                                    )}
                                </div>
                            )}
                            {result.runResult && (
                                <div style={{ marginTop: '2rem' }}>
                                    <h4>Запуск (dry-run): {result.runResult.success ? '✅ Успішно' : '❌ Помилка'}</h4>
                                    <p>Вивід: {result.runResult.output}</p>
                                    {result.runResult.warnings && <p>Попередження: {result.runResult.warnings}</p>}
                                </div>
                            )}
                        </div>
                    )}
                    {result.activeTab === 'secrets' && (
                        <div>
                            {result.secretsStatus.length === 0 ? (
                                <p>Ця форма не містить секретів.</p>
                            ) : (
                                <ul style={{ paddingLeft: '1.25rem' }}>
                                    {result.secretsStatus.map(item => (
                                        <li key={item.fieldKey} style={{ marginBottom: '0.5rem' }}>
                                            <strong>{item.label}</strong>: {item.alias || '(не вказано)'} — {item.status}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (wizardStep === 'summary') {
        const displayEntries = allFields.map(field => {
            const value = formData[field.key] ?? field.default ?? (field.type === 'checkbox' ? false : '');
            const displayValue = typeof value === 'boolean' ? (value ? 'Так' : 'Ні') : (value === '' ? '(порожньо)' : value);
            return { key: field.key, label: field.label, value: displayValue };
        });

        return (
            <div>
                <nav style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#6c757d' }}>
                    Шаблони → {formDef.title} → Підсумок
                </nav>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <button
                        onClick={handleFillSample}
                        style={{ padding: '0.5rem 1rem', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        Заповнити прикладом
                    </button>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input type="checkbox" checked={strictMode} onChange={(e) => setStrictMode(e.target.checked)} />
                        Строгий режим (prod)
                    </label>
                </div>
                {unresolvedRequired.length > 0 && !strictMode && (
                    <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#fff3cd', borderRadius: '4px', border: '1px solid #ffeeba' }}>
                        <strong>Попередження:</strong> деякі обов'язкові поля порожні. У dev-режимі builder використає default/sample.
                    </div>
                )}
                {unresolvedRequired.length > 0 && strictMode && (
                    <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f8d7da', borderRadius: '4px', border: '1px solid #f5c6cb', color: '#721c24' }}>
                        Заповніть поля: {unresolvedRequired.map(f => getLabel(f.key)).join(', ')}
                    </div>
                )}
                <h2>Підсумок налаштувань</h2>
                <div style={{ marginBottom: '2rem', border: '1px solid #e0e0e0', borderRadius: '4px' }}>
                    {displayEntries.map(item => (
                        <div key={item.key} style={{ padding: '0.5rem', borderBottom: '1px solid #e0e0e0' }}>
                            <strong>{item.label}:</strong> {item.value || '(порожньо)'}
                        </div>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={prevStep} style={{ padding: '0.5rem 1rem', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        Назад
                    </button>
                    <button onClick={handleGenerate} disabled={loading} style={{ padding: '0.5rem 1rem', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        {loading ? 'Генерація...' : 'Згенерувати'}
                    </button>
                </div>
            </div>
        );
    }

    const currentFields = wizardStep === 'basic' ? requiredFields : optionalFields;

    return (
        <div>
            <nav style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#6c757d' }}>
                Шаблони → {formDef.title} → {wizardStep === 'basic' ? 'Основне' : 'Додаткове'}
            </nav>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2>{wizardStep === 'basic' ? 'Основні налаштування' : 'Додаткові налаштування'}</h2>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <button
                        onClick={handleFillSample}
                        style={{ padding: '0.5rem 1rem', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        Заповнити прикладом
                    </button>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input type="checkbox" checked={strictMode} onChange={(e) => setStrictMode(e.target.checked)} />
                        Строгий режим (prod)
                    </label>
                </div>
            </div>
            {unresolvedRequired.length > 0 && !strictMode && wizardStep === 'basic' && (
                <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#fff3cd', borderRadius: '4px', border: '1px solid #ffeeba' }}>
                    Заповніть прикладом або введіть значення – builder у dev-режимі заповнить sample/default.
                </div>
            )}
            <div style={{ marginBottom: '2rem' }}>
                {currentFields.map(renderField)}
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
                {wizardStep === 'advanced' && (
                    <button onClick={prevStep} style={{ padding: '0.5rem 1rem', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        Назад
                    </button>
                )}
                <button onClick={nextStep} style={{ padding: '0.5rem 1rem', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    {wizardStep === 'basic' ? 'Далі' : 'Підсумок'}
                </button>
            </div>
        </div>
    );
}
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
