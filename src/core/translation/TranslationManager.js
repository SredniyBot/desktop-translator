// File: src/core/translation/TranslationManager.js
const TranslationProviderFactory = require('./TranslationProviderFactory');
const TranslationContext = require('./TranslationContext');

class TranslationManager {
    constructor() {
        this.providerFactory = new TranslationProviderFactory();
        this.activeProvider = null;
        this.apiKey = null;

        this.cache = new Map();
        this.maxCacheSize = 100;
        this.cacheTTL = 24 * 60 * 60 * 1000;

        this.history = [];
        this.maxHistorySize = 50;

        this.settingsStore = null;
        this.context = null;
    }

    async initialize(providerName, apiKey, config = {}) {
        this.activeProvider = this.providerFactory.createProvider(providerName, config);
        this.apiKey = apiKey;
        await this.activeProvider.initialize(apiKey);
        this.initializeContext();
    }

    setSettingsStore(store) {
        this.settingsStore = store;
        this.initializeContext();
    }

    initializeContext() {
        if (!this.settingsStore) return;

        const settings = this.settingsStore.getAll().translation || {};
        const primary = settings.primaryLanguage || 'ru';
        const secondary = settings.secondLanguage || 'en';
        const timeout = settings.sessionTimeout || 60;

        if (!this.context) {
            this.context = new TranslationContext(primary, secondary, timeout);
        } else {
            this.context.updateConfig(primary, secondary, timeout);
        }
    }

    async translate(text, sourceLang, targetLang) {
        if (!text || !text.trim()) {
            return { translatedText: '', error: 'Empty text' };
        }

        if (!this.activeProvider) {
            await this.initialize('mock', 'mock-key');
        }

        const settings = this.settingsStore ? this.settingsStore.getAll().translation : {};

        if (this.context) {
            this.context.checkTimeout();
            if (sourceLang && sourceLang !== 'auto' && targetLang) {
                this.context.setManualPair(sourceLang, targetLang);
            }
        }

        let finalTarget = targetLang || (this.context ? this.context.currentTarget : (settings.primaryLanguage || 'ru'));
        let requestSource = (!sourceLang || sourceLang === 'auto') ? 'auto' : sourceLang;
        let assumedSource = requestSource === 'auto' ? (this.context ? this.context.currentSource : 'en') : requestSource;

        let cacheKey = this.getCacheKey(text, assumedSource, finalTarget);
        let cached = this.cache.get(cacheKey);

        if (cached && this.isCacheValid(cached)) {
            return { ...cached, fromCache: true };
        }

        try {
            let result = await this.activeProvider.translate(text, requestSource, finalTarget);
            if (result.error) throw result.error;

            let detectedLang = result.detectedLanguage || result.sourceLang || assumedSource;

            if (this.context && requestSource === 'auto') {
                const isInverted = this.context.updateFromApiResult(detectedLang);

                if (isInverted) {
                    finalTarget = this.context.currentTarget;
                    cacheKey = this.getCacheKey(text, detectedLang, finalTarget);
                    cached = this.cache.get(cacheKey);

                    if (cached && this.isCacheValid(cached)) {
                        return { ...cached, fromCache: true };
                    }

                    result = await this.activeProvider.translate(text, 'auto', finalTarget);
                    if (result.error) throw result.error;

                    detectedLang = result.detectedLanguage || result.sourceLang || detectedLang;
                }
            }

            const response = {
                translatedText: result.text,
                sourceLang: detectedLang,
                targetLang: finalTarget,
                detectedLanguage: detectedLang,
                provider: this.activeProvider.name,
                timestamp: Date.now()
            };

            cacheKey = this.getCacheKey(text, detectedLang, finalTarget);
            this.addToCache(cacheKey, response);

            this.addToHistory({
                text,
                sourceLang: response.sourceLang,
                targetLang: response.targetLang,
                result: response.translatedText,
                provider: this.activeProvider.name,
                timestamp: Date.now()
            });

            return response;

        } catch (error) {
            return {
                translatedText: '',
                error: error.message,
                provider: this.activeProvider.name,
                errorType: error.type
            };
        }
    }

    async getSupportedLanguages() {
        if (!this.activeProvider) return this.getDefaultLanguages();
        try {
            return await this.activeProvider.getSupportedLanguages();
        } catch (error) {
            return this.getDefaultLanguages();
        }
    }

    async testConnection() {
        if (!this.activeProvider) return { success: false, error: 'No active provider' };
        try {
            return await this.activeProvider.testConnection();
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async testProviderConnection(providerName, apiKey, config = {}) {
        try {
            const provider = this.providerFactory.createProvider(providerName, config);
            await provider.initialize(apiKey);
            return await provider.testConnection();
        } catch (error) {
            return {
                success: false,
                error: error.message,
                details: { provider: providerName, error: error.response?.status }
            };
        }
    }

    async switchProvider(providerName, apiKey, config = {}) {
        try {
            const newProvider = this.providerFactory.createProvider(providerName, config);
            await newProvider.initialize(apiKey);
            this.activeProvider = newProvider;
            this.apiKey = apiKey;
            this.clearCache();
            return true;
        } catch (error) {
            return false;
        }
    }

    getCurrentProviderInfo() {
        if (!this.activeProvider) return { name: 'none', initialized: false };
        return {
            name: this.activeProvider.name,
            initialized: true
        };
    }

    getAvailableProviders() {
        return this.providerFactory.getAvailableProviders();
    }

    getTranslationHistory(limit = 10) {
        return this.history.slice(0, limit);
    }

    clearHistory() {
        this.history = [];
    }

    clearCache() {
        this.cache.clear();
    }

    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize,
            historySize: this.history.length
        };
    }

    getCacheKey(text, sourceLang, targetLang) {
        const providerName = this.activeProvider ? this.activeProvider.name : 'none';
        return `${providerName}:${text}:${sourceLang}:${targetLang}`;
    }

    isCacheValid(cacheEntry) {
        if (!cacheEntry.timestamp) return false;
        return (Date.now() - cacheEntry.timestamp) < this.cacheTTL;
    }

    addToCache(key, result) {
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, {
            ...result,
            timestamp: Date.now()
        });
    }

    addToHistory(translation) {
        this.history.unshift(translation);
        if (this.history.length > this.maxHistorySize) {
            this.history = this.history.slice(0, this.maxHistorySize);
        }
    }

    getDefaultLanguages() {
        return [
            { code: 'en', name: 'Английский' },
            { code: 'ru', name: 'Русский' },
            { code: 'es', name: 'Испанский' },
            { code: 'fr', name: 'Французский' },
            { code: 'de', name: 'Немецкий' },
            { code: 'zh', name: 'Китайский' }
        ];
    }
}

module.exports = TranslationManager;