// File: src/core/translation/TranslationProviderFactory.js
const MockTranslationProvider = require('./providers/MockTranslationProvider');
const YandexTranslationProvider = require('./providers/YandexTranslationProvider');
const GoogleTranslationProvider = require('./providers/GoogleTranslationProvider');
const Logger = require('../../utils/Logger');

/**
 * Фабрика для создания экземпляров провайдеров перевода
 */
class TranslationProviderFactory {
    constructor() {
        this.logger = new Logger('TranslationProviderFactory');
        this.providerCache = new Map();
    }

    /**
     * Создает экземпляр провайдера по имени
     * @param {string} providerName - Имя провайдера (mock, yandex, google)
     * @param {Object} config - Конфигурация провайдера
     * @returns {ITranslationProvider}
     */
    createProvider(providerName, config = {}) {
        // Создаем уникальный ключ кэша
        const cacheKey = this.getCacheKey(providerName, config);

        if (this.providerCache.has(cacheKey)) {
            return this.providerCache.get(cacheKey);
        }

        let provider;
        try {
            switch (providerName) {
                case 'mock':
                    provider = new MockTranslationProvider(config);
                    break;

                case 'yandex':
                    provider = new YandexTranslationProvider(config);
                    break;

                case 'google':
                    provider = new GoogleTranslationProvider(config);
                    break;

                default:
                    this.logger.warn(`Unknown provider "${providerName}", falling back to mock`);
                    provider = new MockTranslationProvider(config);
            }

            // Кэшируем провайдер
            this.providerCache.set(cacheKey, provider);
            return provider;
        } catch (error) {
            this.logger.error(`Failed to create provider ${providerName}:`, error);
            return new MockTranslationProvider(config);
        }
    }

    /**
     * Получает список доступных провайдеров и их настройки для UI
     */
    getAvailableProviders() {
        return [
            {
                name: 'mock',
                label: 'Mock Переводчик',
                description: 'Тестовый провайдер (без интернета)',
                icon: 'fas fa-vial',
                requiresApiKey: false,
                configFields: []
            },
            {
                name: 'yandex',
                label: 'Yandex Translate',
                description: 'Yandex Cloud (требуется Service Account Key)',
                icon: 'fab fa-yandex',
                requiresApiKey: true,
                configFields: [
                    {
                        id: 'folderId',
                        type: 'text',
                        label: 'Folder ID',
                        description: 'ID каталога Yandex Cloud (например: b1g...)',
                        placeholder: 'b1g7q9...',
                        required: true
                    }
                ]
            },
            {
                name: 'google',
                label: 'Google Translate',
                description: 'Google Cloud Translation API',
                icon: 'fab fa-google',
                requiresApiKey: true,
                configFields: [
                    {
                        id: 'projectId',
                        type: 'text',
                        label: 'Project ID',
                        description: 'Google Cloud Project ID',
                        placeholder: 'my-project-123456'
                    },
                    {
                        id: 'location',
                        type: 'text',
                        label: 'Location',
                        description: 'Локация (обычно global)',
                        placeholder: 'global',
                        defaultValue: 'global'
                    }
                ]
            }
        ];
    }

    /**
     * Получает информацию о конкретном провайдере
     */
    getProviderInfo(providerName) {
        const providers = this.getAvailableProviders();
        return providers.find(p => p.name === providerName) || providers[0];
    }

    clearCache() {
        this.providerCache.clear();
        this.logger.info('Provider cache cleared');
    }

    invalidateCache(providerName, config = {}) {
        const cacheKey = this.getCacheKey(providerName, config);
        this.providerCache.delete(cacheKey);
    }

    getCacheKey(providerName, config) {
        // Сортируем ключи конфига для стабильности кэш-ключа
        const stableConfig = Object.keys(config).sort().reduce((obj, key) => {
            obj[key] = config[key];
            return obj;
        }, {});
        return `${providerName}:${JSON.stringify(stableConfig)}`;
    }
}

module.exports = TranslationProviderFactory;