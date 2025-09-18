import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const SUPPORTED_LANGUAGES = ['en'];
export const DEFAULT_LANGUAGE = 'en';

const resourcesCache = new Map();
let activeLanguage = DEFAULT_LANGUAGE;
const supportedLanguageSet = new Set(SUPPORTED_LANGUAGES);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadLocaleResources(language) {
    if (resourcesCache.has(language)) {
        return resourcesCache.get(language);
    }

    try {
        const localeFilePath = path.join(__dirname, 'locales', language, 'app.json');
        const fileContent = readFileSync(localeFilePath, 'utf8');
        const parsed = JSON.parse(fileContent);
        resourcesCache.set(language, parsed);
        return parsed;
    } catch (error) {
        if (language !== DEFAULT_LANGUAGE) {
            const fallback = loadLocaleResources(DEFAULT_LANGUAGE);
            resourcesCache.set(language, fallback);
            return fallback;
        }
        throw error;
    }
}

function getTranslation(tree, key) {
    const segments = key.split('.');
    let current = tree;

    for (const segment of segments) {
        if (typeof current !== 'object' || current === null) {
            return undefined;
        }

        if (!Object.prototype.hasOwnProperty.call(current, segment)) {
            return undefined;
        }

        current = current[segment];
    }

    return typeof current === 'string' ? current : undefined;
}

function formatMessage(template, params) {
    if (!params) {
        return template;
    }

    return template.replace(/\{\{(.*?)\}\}/g, (_, rawKey) => {
        const trimmedKey = rawKey.trim();
        if (Object.prototype.hasOwnProperty.call(params, trimmedKey)) {
            const value = params[trimmedKey];
            return value === undefined || value === null ? '' : String(value);
        }
        return '';
    });
}

export function getSupportedLanguages() {
    return [...SUPPORTED_LANGUAGES];
}

export function isSupportedLanguage(language) {
    if (typeof language !== 'string') {
        return false;
    }

    return supportedLanguageSet.has(language);
}

export function setLanguage(language) {
    const normalized = typeof language === 'string' ? language.trim().toLowerCase() : '';
    if (isSupportedLanguage(normalized)) {
        activeLanguage = normalized;
    } else {
        activeLanguage = DEFAULT_LANGUAGE;
    }

    loadLocaleResources(activeLanguage);
    return activeLanguage;
}

export function getCurrentLanguage() {
    return activeLanguage;
}

export function t(key, params) {
    const activeResources = loadLocaleResources(activeLanguage);
    const fallbackResources = loadLocaleResources(DEFAULT_LANGUAGE);

    let message = getTranslation(activeResources, key);

    if (message === undefined) {
        message = getTranslation(fallbackResources, key);
    }

    if (message === undefined) {
        return key;
    }

    return formatMessage(message, params);
}

// Warm up the default locale so the cache always has English resources.
loadLocaleResources(DEFAULT_LANGUAGE);
