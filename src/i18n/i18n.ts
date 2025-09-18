import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

type TranslationValue = string | TranslationTree;
interface TranslationTree {
    [key: string]: TranslationValue;
}
export type TranslationParams = Record<string, string | number>;

export const SUPPORTED_LANGUAGES = ['en'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

const resourcesCache = new Map<string, TranslationTree>();
let activeLanguage: SupportedLanguage = DEFAULT_LANGUAGE;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadLocaleResources(language: string): TranslationTree {
    if (resourcesCache.has(language)) {
        return resourcesCache.get(language)!;
    }

    try {
        const localeFilePath = path.join(__dirname, 'locales', language, 'app.json');
        const fileContent = readFileSync(localeFilePath, 'utf8');
        const parsed = JSON.parse(fileContent) as TranslationTree;
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

function getTranslation(tree: TranslationTree, key: string): string | undefined {
    const segments = key.split('.');
    let current: TranslationValue = tree;

    for (const segment of segments) {
        if (typeof current !== 'object' || current === null) {
            return undefined;
        }

        if (!(segment in current)) {
            return undefined;
        }

        current = (current as TranslationTree)[segment];
    }

    return typeof current === 'string' ? current : undefined;
}

function formatMessage(template: string, params?: TranslationParams): string {
    if (!params) {
        return template;
    }

    return template.replace(/\{\{(.*?)\}\}/g, (_, rawKey: string) => {
        const trimmedKey = rawKey.trim();
        if (Object.prototype.hasOwnProperty.call(params, trimmedKey)) {
            const value = params[trimmedKey];
            return value === undefined || value === null ? '' : String(value);
        }
        return '';
    });
}

export function getSupportedLanguages(): SupportedLanguage[] {
    return [...SUPPORTED_LANGUAGES];
}

export function isSupportedLanguage(language: string): language is SupportedLanguage {
    return SUPPORTED_LANGUAGES.includes(language as SupportedLanguage);
}

export function setLanguage(language: string | undefined | null): SupportedLanguage {
    const normalized = typeof language === 'string' ? language.trim().toLowerCase() : '';
    if (isSupportedLanguage(normalized)) {
        activeLanguage = normalized;
    } else {
        activeLanguage = DEFAULT_LANGUAGE;
    }

    loadLocaleResources(activeLanguage);
    return activeLanguage;
}

export function getCurrentLanguage(): SupportedLanguage {
    return activeLanguage;
}

export function t(key: string, params?: TranslationParams): string {
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
