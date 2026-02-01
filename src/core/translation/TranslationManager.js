const TranslationProviderFactory = require('./TranslationProviderFactory');
const Logger = require('../../utils/Logger');

/**
 * Менеджер перевода - основной сервис для работы с переводами
 * Заменяет старый TranslationService
 */
class TranslationManager {
    constructor() {
        this.logger = new Logger('TranslationManager');
        this.providerFactory = new TranslationProviderFactory();
        this.activeProvider = null;
        this.apiKey = null;
        this.cache = new Map();
        this.maxCacheSize = 100;
        this.cacheTTL = 24 * 60 * 60 * 1000; // 24 часа
        this.history = [];
        this.maxHistorySize = 50;
    }

    /**
     * Инициализация менеджера
     * @param {string} providerName - Имя провайдера
     * @param {string} apiKey - API ключ
     * @param {Object} config - Конфигурация провайдера
     */
    async initialize(providerName, apiKey, config = {}) {
        try {
            this.logger.info(`Initializing translation manager with provider: ${providerName}`);

            // Создаем провайдера
            this.activeProvider = this.providerFactory.createProvider(providerName, config);
            this.apiKey = apiKey;

            // Инициализируем провайдера
            await this.activeProvider.initialize(apiKey);

            this.logger.info(`Translation manager initialized with provider: ${providerName}`);

        } catch (error) {
            this.logger.error('Failed to initialize translation manager:', error);
            throw error;
        }
    }

    /**
     * Выполняет перевод текста
     * @param {string} text - Текст для перевода
     * @param {string} sourceLang - Исходный язык (код)
     * @param {string} targetLang - Целевой язык (код)
     * @returns {Promise<Object>} Результат перевода
     */
    async translate(text, sourceLang, targetLang) {
        if (!text || !text.trim()) {
            return { translatedText: '', error: 'Empty text' };
        }

        // Проверяем, инициализирован ли провайдер
        if (!this.activeProvider) {
            this.logger.warn('No active provider, using mock as fallback');
            await this.initialize('mock', 'mock-key');
        }

        // Проверяем кэш
        const cacheKey = this.getCacheKey(text, sourceLang, targetLang);
        const cached = this.cache.get(cacheKey);

        if (cached && this.isCacheValid(cached)) {
            this.logger.debug('Translation from cache');
            return { translatedText: cached.text, provider: cached.provider };
        }

        try {
            // Выполняем перевод через активный провайдер
            const result = await this.activeProvider.translate(text, sourceLang, targetLang);

            // Обработка ошибок провайдера
            if (result.error) {
                this.logger.error('Provider translation error:', result.error);

                // Если есть ошибка, не кэшируем и возвращаем ошибку
                return {
                    translatedText: '',
                    error: result.error.message,
                    provider: this.activeProvider.name,
                    errorType: result.error.type
                };
            }

            // Сохраняем в кэш
            this.addToCache(cacheKey, result);

            // Сохраняем в историю
            this.addToHistory({
                text,
                sourceLang,
                targetLang,
                result: result.text,
                provider: this.activeProvider.name,
                timestamp: Date.now()
            });

            // Форматируем результат для обратной совместимости
            return {
                translatedText: result.text,
                provider: this.activeProvider.name,
                detectedLanguage: result.detectedLanguage,
                confidence: result.confidence
            };

        } catch (error) {
            this.logger.error('Translation failed:', error);

            // Fallback на моковый перевод при ошибке
            if (this.activeProvider.name !== 'mock') {
                this.logger.info('Falling back to mock provider');
                const fallbackProvider = this.providerFactory.createProvider('mock');
                await fallbackProvider.initialize('mock-key');
                const fallbackResult = await fallbackProvider.translate(text, sourceLang, targetLang);

                return {
                    translatedText: fallbackResult.text,
                    provider: 'mock',
                    error: `Ошибка ${this.activeProvider.name}: ${error.message}`,
                    fallback: true
                };
            }

            return {
                translatedText: '',
                error: error.message,
                provider: this.activeProvider.name
            };
        }
    }

    /**
     * Получает список поддерживаемых языков
     * @returns {Promise<Array>}
     */
    async getSupportedLanguages() {
        if (!this.activeProvider) {
            this.logger.warn('No active provider, returning default languages');
            return this.getDefaultLanguages();
        }

        try {
            const languages = await this.activeProvider.getSupportedLanguages();
            return languages;
        } catch (error) {
            this.logger.error('Failed to get supported languages:', error);
            return this.getDefaultLanguages();
        }
    }

    /**
     * Тестирует соединение с текущим провайдером
     * @returns {Promise<Object>}
     */
    async testConnection() {
        if (!this.activeProvider) {
            return { success: false, error: 'No active provider' };
        }

        try {
            const result = await this.activeProvider.testConnection();
            return {
                success: result.success,
                message: result.message,
                responseTime: result.responseTime,
                details: result.details
            };
        } catch (error) {
            this.logger.error('Connection test failed:', error);
            return {
                success: false,
                error: error.message,
                responseTime: 0
            };
        }
    }

    /**
     * Тестирует API ключ для провайдера
     * @param {string} providerName - Имя провайдера
     * @param {string} apiKey - API ключ
     * @param {Object} config - Конфигурация
     * @returns {Promise<Object>}
     */
    async testProviderConnection(providerName, apiKey, config = {}) {
        try {
            // Создаем временный провайдер для тестирования
            const provider = this.providerFactory.createProvider(providerName, config);
            await provider.initialize(apiKey);

            const result = await provider.testConnection();

            return {
                success: result.success,
                message: result.message,
                responseTime: result.responseTime,
                details: result.details
            };

        } catch (error) {
            this.logger.error(`Provider ${providerName} connection test failed:`, error);

            return {
                success: false,
                error: error.message,
                responseTime: 0,
                details: {
                    provider: providerName,
                    error: error.response?.status || error.code
                }
            };
        }
    }

    /**
     * Переключает активного провайдера
     * @param {string} providerName - Новый провайдер
     * @param {string} apiKey - API ключ
     * @param {Object} config - Конфигурация
     */
    async switchProvider(providerName, apiKey, config = {}) {
        try {
            this.logger.info(`Switching provider to: ${providerName}`);

            // Создаем нового провайдера
            const newProvider = this.providerFactory.createProvider(providerName, config);
            await newProvider.initialize(apiKey);

            // Заменяем активного провайдера
            this.activeProvider = newProvider;
            this.apiKey = apiKey;

            // Очищаем кэш при смене провайдера
            this.clearCache();

            this.logger.info(`Provider switched to: ${providerName}`);

            return true;

        } catch (error) {
            this.logger.error(`Failed to switch provider to ${providerName}:`, error);
            return false;
        }
    }

    /**
     * Получает информацию о текущем провайдере
     * @returns {Object}
     */
    getCurrentProviderInfo() {
        if (!this.activeProvider) {
            return { name: 'none', initialized: false };
        }

        return {
            name: this.activeProvider.name,
            initialized: true,
            supportedLanguages: this.cache.has('languages')
        };
    }

    /**
     * Получает список доступных провайдеров
     * @returns {Array}
     */
    getAvailableProviders() {
        return this.providerFactory.getAvailableProviders();
    }

    /**
     * Получает историю переводов
     * @param {number} limit - Максимальное количество записей
     * @returns {Array}
     */
    getTranslationHistory(limit = 10) {
        return this.history.slice(0, limit);
    }

    /**
     * Очищает историю переводов
     */
    clearHistory() {
        this.history = [];
        this.logger.info('Translation history cleared');
    }

    /**
     * Очищает кэш переводов
     */
    clearCache() {
        this.cache.clear();
        this.logger.info('Translation cache cleared');
    }

    /**
     * Получает статистику кэша
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize,
            historySize: this.history.length,
            maxHistorySize: this.maxHistorySize
        };
    }

    // Приватные методы

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
        // Очищаем кэш если превышен лимит
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            text: result.text,
            provider: result.provider || this.activeProvider.name,
            timestamp: result.timestamp || Date.now()
        });
    }

    addToHistory(translation) {
        this.history.unshift(translation);

        // Ограничиваем размер истории
        if (this.history.length > this.maxHistorySize) {
            this.history = this.history.slice(0, this.maxHistorySize);
        }
    }

    getDefaultLanguages() {
        return [
            { code: 'en', name: 'Английский', nativeName: 'English' },
            { code: 'ru', name: 'Русский', nativeName: 'Русский' },
            { code: 'es', name: 'Испанский', nativeName: 'Español' },
            { code: 'fr', name: 'Французский', nativeName: 'Français' },
            { code: 'de', name: 'Немецкий', nativeName: 'Deutsch' },
            { code: 'zh', name: 'Китайский', nativeName: '中文' },
            { code: 'ja', name: 'Японский', nativeName: '日本語' },
            { code: 'ko', name: 'Корейский', nativeName: '한국어' },
            { code: 'ar', name: 'Арабский', nativeName: 'العربية', direction: 'rtl' },
            { code: 'pt', name: 'Португальский', nativeName: 'Português' },
            { code: 'it', name: 'Итальянский', nativeName: 'Italiano' }
        ];
    }
}

module.exports = TranslationManager;