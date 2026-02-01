// File: src/core/translation/TranslationManager.js
const TranslationProviderFactory = require('./TranslationProviderFactory');
const Logger = require('../../utils/Logger');
const LanguageUtils = require('../../utils/LanguageUtils');
const TranslationContext = require('./TranslationContext');

/**
 * Менеджер перевода (Core Service)
 * Отвечает за:
 * 1. Управление провайдерами (Yandex, Google, Mock)
 * 2. Кэширование запросов
 * 3. Историю переводов
 * 4. Умное переключение контекста (Smart Switch)
 */
class TranslationManager {
    constructor() {
        this.logger = new Logger('TranslationManager');
        this.providerFactory = new TranslationProviderFactory();
        this.activeProvider = null;
        this.apiKey = null;

        // Кэш и история
        this.cache = new Map();
        this.maxCacheSize = 100;
        this.cacheTTL = 24 * 60 * 60 * 1000; // 24 часа
        this.history = [];
        this.maxHistorySize = 50;

        // Ссылка на SettingsStore (для чтения конфига)
        this.settingsStore = null;

        // Контекст (машина состояний)
        this.context = null;
    }

    /**
     * Инициализирует менеджер с конкретным провайдером
     */
    async initialize(providerName, apiKey, config = {}) {
        try {
            this.logger.info(`Initializing translation manager with provider: ${providerName}`);
            this.activeProvider = this.providerFactory.createProvider(providerName, config);
            this.apiKey = apiKey;
            await this.activeProvider.initialize(apiKey);

            this.initializeContext();

            this.logger.info(`Translation manager initialized with provider: ${providerName}`);
        } catch (error) {
            this.logger.error('Failed to initialize translation manager:', error);
            throw error;
        }
    }

    /**
     * Устанавливает ссылку на store для доступа к настройкам
     */
    setSettingsStore(store) {
        this.settingsStore = store;
        this.initializeContext();
    }

    /**
     * Инициализирует или обновляет контекст перевода на основе настроек
     */
    initializeContext() {
        if (!this.settingsStore) return;

        const settings = this.settingsStore.getAll().translation || {};
        const primary = settings.primaryLanguage || 'ru';
        const secondary = settings.secondLanguage || 'en';
        const timeout = settings.sessionTimeout || 60;

        if (!this.context) {
            this.logger.info('Creating new Translation Context');
            this.context = new TranslationContext(primary, secondary, timeout);
        } else {
            this.context.updateConfig(primary, secondary, timeout);
        }
    }

    /**
     * Выполняет перевод текста
     * @param {string} text - Текст для перевода
     * @param {string} sourceLang - Исходный язык ('auto' или код)
     * @param {string} targetLang - Целевой язык (или null для автовыбора)
     * @param {Object} options - Опции вызова ({ isExternal: boolean })
     */
    async translate(text, sourceLang, targetLang, options = { isExternal: false }) {
        if (!text || !text.trim()) {
            return { translatedText: '', error: 'Empty text' };
        }

        // 1. Проверка наличия провайдера (fallback на mock)
        if (!this.activeProvider) {
            this.logger.warn('No active provider, using mock as fallback');
            await this.initialize('mock', 'mock-key');
        }

        // 2. Чтение настроек
        const settings = this.settingsStore ? this.settingsStore.getAll().translation : {};
        const isSmart = settings.smartSwitch !== false; // По умолчанию включено

        let finalSource = sourceLang;
        let finalTarget = targetLang;

        // 3. Логика Context Aware
        if (isSmart && this.context && sourceLang === 'auto') {
            // Детектим язык с подсказкой из контекста
            const detected = LanguageUtils.detectLanguage(text, [
                this.context.primary,
                this.context.lastForeign
            ]);

            this.logger.debug(`Detected language: ${detected} (isExternal=${options.isExternal})`);

            // Обновляем состояние контекста
            if (options.isExternal) {
                this.context.handleExternalInput(detected);
            } else {
                this.context.handleInputUpdate(detected);
            }

            // Получаем пару из контекста
            const pair = this.context.getCurrentPair();

            if (detected) {
                finalSource = (pair.source === 'auto') ? detected : pair.source;
            } else {
                finalSource = 'auto';
            }
            finalTarget = pair.target;
        }

        // Fallback: Если target все еще не определен
        if (!finalTarget) {
            finalTarget = settings.primaryLanguage;
        }

        // 4. Проверка кэша
        const cacheKey = this.getCacheKey(text, finalSource, finalTarget);
        const cached = this.cache.get(cacheKey);

        if (cached && this.isCacheValid(cached)) {
            this.logger.debug('Translation from cache');
            return { ...cached, fromCache: true };
        }

        // 5. Вызов провайдера
        try {
            const result = await this.activeProvider.translate(text, finalSource, finalTarget);

            if (result.error) {
                throw result.error;
            }

            const response = {
                translatedText: result.text,
                sourceLang: result.sourceLang,
                targetLang: result.targetLang,
                detectedLanguage: result.detectedLanguage || finalSource,
                provider: this.activeProvider.name,
                timestamp: Date.now()
            };

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
            this.logger.error('Translation failed:', error);
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
            this.logger.error(`Failed to switch provider to ${providerName}:`, error);
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
        const age = Date.now() - cacheEntry.timestamp;
        return age < this.cacheTTL;
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