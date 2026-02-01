// File: src/core/translation/providers/YandexTranslationProvider.js
const axios = require('axios');
const { ITranslationProvider, TranslationResult, Language, ConnectionTestResult, ValidationResult, TranslationError } = require('../ITranslationProvider');
const Logger = require('../../../utils/Logger');

/**
 * Yandex Translate API Provider (Yandex Cloud)
 * Использует авторизацию через API-ключ сервисного аккаунта.
 * Документация: https://cloud.yandex.ru/docs/translate/api-ref/Translation/translate
 */
class YandexTranslationProvider extends ITranslationProvider {
    constructor(config = {}) {
        super(config);
        this.logger = new Logger('YandexTranslationProvider');
        this.apiKey = null;
        // Folder ID обязателен для работы v2 API
        this.folderId = config.folderId ? config.folderId.trim() : '';
        this.apiBaseUrl = 'https://translate.api.cloud.yandex.net/translate/v2';
        this.supportedLanguages = null;
    }

    get name() {
        return 'yandex';
    }

    async initialize(apiKey) {
        if (!apiKey) {
            throw new Error('API ключ не предоставлен');
        }
        this.apiKey = apiKey.trim();

        if (!this.folderId) {
            this.logger.warn('Folder ID is missing. Yandex Cloud Translation might fail.');
        }

        this.logger.info('Yandex translation provider initialized');
        // Не блокируем инициализацию загрузкой языков, сделаем это лениво при первом запросе
        return Promise.resolve();
    }

    async translate(text, sourceLang, targetLang) {
        try {
            if (!this.apiKey) throw new Error('Provider not initialized: missing API key');
            if (!this.folderId) throw new Error('Provider config error: missing Folder ID');

            // Подготовка тела запроса согласно спецификации Yandex Cloud
            const body = {
                folderId: this.folderId,
                texts: [text],
                targetLanguageCode: targetLang,
                format: 'PLAIN_TEXT'
            };

            // Если язык задан явно и не равен auto, добавляем его
            if (sourceLang && sourceLang !== 'auto') {
                body.sourceLanguageCode = sourceLang;
            }

            // Запрос к API
            const response = await this.makeRequest('translate', body);

            const translationData = response.translations?.[0];
            if (!translationData) {
                throw new Error('API вернул пустой список переводов');
            }

            return new TranslationResult({
                text: translationData.text,
                sourceLang: translationData.detectedLanguageCode || sourceLang,
                targetLang,
                provider: this.name,
                detectedLanguage: translationData.detectedLanguageCode || null,
                confidence: translationData.detectedLanguageCode ? 0.95 : null
            });

        } catch (error) {
            this.logger.error('Yandex translation error:', error.message);
            const yandexError = this.mapYandexError(error);

            return new TranslationResult({
                text: '',
                sourceLang,
                targetLang,
                provider: this.name,
                error: yandexError
            });
        }
    }

    async getSupportedLanguages() {
        if (this.supportedLanguages && this.supportedLanguages.length > 0) {
            return this.supportedLanguages;
        }
        return await this.loadSupportedLanguages();
    }

    async testConnection() {
        try {
            if (!this.apiKey) throw new Error('API Key is missing');
            if (!this.folderId) throw new Error('Folder ID is missing');

            const startTime = Date.now();

            // Пробуем перевести слово "Test" для проверки прав доступа
            const body = {
                folderId: this.folderId,
                texts: ["Test"],
                targetLanguageCode: "ru"
            };

            await this.makeRequest('translate', body);
            const responseTime = Date.now() - startTime;

            return new ConnectionTestResult({
                success: true,
                message: 'Yandex Translate API доступен и настроен корректно',
                responseTime,
                details: {
                    provider: 'Yandex Translate',
                    folderId: this.folderId,
                    authType: 'Service Account API-Key'
                }
            });
        } catch (error) {
            this.logger.error('Yandex connection test failed:', error);
            return new ConnectionTestResult({
                success: false,
                message: this.getErrorMessage(error),
                responseTime: 0,
                details: {
                    error: error.response?.data?.message || error.message,
                    statusCode: error.response?.status,
                    provider: 'Yandex Translate'
                }
            });
        }
    }

    async validateApiKey(apiKey) {
        // Для Yandex валидация ключа невозможна без FolderID в контексте этого метода.
        // Поэтому мы делаем базовую проверку формата.
        const isValidFormat = apiKey && apiKey.length > 20;

        return new ValidationResult({
            valid: isValidFormat,
            message: isValidFormat ? 'Формат ключа корректен' : 'Ключ слишком короткий',
            details: {
                provider: 'Yandex Translate',
                validation: 'format_check'
            }
        });
    }

    // Вспомогательные методы

    async makeRequest(endpoint, data = {}, method = 'POST') {
        const url = `${this.apiBaseUrl}/${endpoint}`;

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Api-Key ${this.apiKey}`
        };

        const config = {
            method,
            url,
            headers,
            timeout: 10000,
            validateStatus: status => status >= 200 && status < 300
        };

        if (method === 'POST') {
            config.data = data;
        } else {
            config.params = data;
        }

        const response = await axios(config);
        return response.data;
    }

    async loadSupportedLanguages() {
        try {
            if (!this.apiKey || !this.folderId) {
                return this.getDefaultLanguages();
            }

            // Yandex требует folderId даже для списка языков
            const body = {
                folderId: this.folderId
            };

            const response = await this.makeRequest('languages', body, 'POST');

            this.supportedLanguages = (response.languages || []).map(lang =>
                new Language({
                    code: lang.code,
                    name: lang.name || lang.code, // Иногда имя может отсутствовать
                    direction: 'ltr'
                })
            );

            // Сортируем по коду для удобства
            this.supportedLanguages.sort((a, b) => a.code.localeCompare(b.code));

            return this.supportedLanguages;
        } catch (error) {
            this.logger.error('Failed to load Yandex supported languages:', error);
            return this.getDefaultLanguages();
        }
    }

    mapYandexError(error) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;
        const code = error.response?.data?.code; // Yandex часто возвращает текстовый код ошибки

        // Обработка специфичных ошибок Yandex Cloud
        if (code === 16 || status === 401) {
            return new TranslationError({
                type: 'INVALID_API_KEY',
                message: 'Ошибка авторизации. Проверьте API Key и права сервисного аккаунта.',
                details: message,
                retryable: false
            });
        }

        if (message.includes('folder') || message.includes('folderId')) {
            return new TranslationError({
                type: 'INVALID_REQUEST',
                message: 'Неверный Folder ID или у аккаунта нет прав на этот каталог.',
                details: message,
                retryable: false
            });
        }

        switch (status) {
            case 403:
                return new TranslationError({
                    type: 'QUOTA_EXCEEDED',
                    message: 'Доступ запрещен или квота исчерпана.',
                    details: message,
                    retryable: false
                });
            case 429:
                return new TranslationError({
                    type: 'RATE_LIMITED',
                    message: 'Слишком много запросов.',
                    details: message,
                    retryable: true
                });
            case 400:
                return new TranslationError({
                    type: 'INVALID_REQUEST',
                    message: 'Некорректный запрос к API.',
                    details: message,
                    retryable: false
                });
            default:
                return new TranslationError({
                    type: 'PROVIDER_ERROR',
                    message: `Ошибка Yandex API: ${message}`,
                    details: { status, code, message },
                    retryable: true
                });
        }
    }

    getErrorMessage(error) {
        const data = error.response?.data;
        if (data && data.message) {
            return `Yandex API Error: ${data.message} (Code: ${data.code || 'N/A'})`;
        }
        if (error.response) {
            return `Ошибка HTTP ${error.response.status}`;
        }
        return error.message || 'Неизвестная ошибка сети';
    }

    getDefaultLanguages() {
        return [
            new Language({ code: 'en', name: 'English' }),
            new Language({ code: 'ru', name: 'Русский' }),
            new Language({ code: 'es', name: 'Spanish' }),
            new Language({ code: 'fr', name: 'French' }),
            new Language({ code: 'de', name: 'German' }),
            new Language({ code: 'zh', name: 'Chinese' }),
            new Language({ code: 'tr', name: 'Turkish' }),
            new Language({ code: 'uk', name: 'Ukrainian' }),
            new Language({ code: 'kz', name: 'Kazakh' })
        ];
    }
}

module.exports = YandexTranslationProvider;