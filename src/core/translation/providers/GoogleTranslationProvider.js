const axios = require('axios');
const { ITranslationProvider, TranslationResult, Language, ConnectionTestResult, ValidationResult, TranslationError } = require('../ITranslationProvider');
const Logger = require('../../../utils/Logger'); // Исправленный путь

/**
 * Google Cloud Translation API провайдер
 * Документация: https://cloud.google.com/translate/docs/reference/rest
 */
class GoogleTranslationProvider extends ITranslationProvider {
    constructor(config = {}) {
        super(config);
        this.logger = new Logger('GoogleTranslationProvider');
        this.apiKey = null;
        this.projectId = config.projectId || '';
        this.location = config.location || 'global';
        this.apiBaseUrl = 'https://translation.googleapis.com/v3';
        this.supportedLanguages = null;
    }

    get name() {
        return 'google';
    }

    async initialize(apiKey) {
        this.apiKey = apiKey;
        this.logger.info('Google translation provider initialized');
        await this.loadSupportedLanguages();
        return Promise.resolve();
    }

    async translate(text, sourceLang, targetLang) {
        try {
            const parent = this.projectId ?
                `projects/${this.projectId}/locations/${this.location}` :
                null;

            const body = {
                contents: [text],
                targetLanguageCode: targetLang,
                mimeType: 'text/plain'
            };

            // Если язык не auto, добавляем source language
            if (sourceLang && sourceLang !== 'auto') {
                body.sourceLanguageCode = sourceLang;
            }

            // Параметры запроса
            const params = {
                key: this.apiKey
            };

            if (parent) {
                body.parent = parent;
            }

            // Запрос к API
            const endpoint = parent ?
                `${this.apiBaseUrl}/${parent}:translateText` :
                `${this.apiBaseUrl}:translateText`;

            const response = await this.makeRequest(endpoint, body, params);

            // Обработка ответа
            const translation = response.translations?.[0];
            if (!translation) {
                throw new Error('Не удалось получить перевод');
            }

            return new TranslationResult({
                text: translation.translatedText,
                sourceLang: translation.detectedLanguageCode || sourceLang,
                targetLang,
                provider: this.name,
                detectedLanguage: translation.detectedLanguageCode || null,
                confidence: translation.detectedLanguageCode ? 0.99 : null
            });

        } catch (error) {
            this.logger.error('Google translation error:', error);

            const googleError = this.mapGoogleError(error);

            return new TranslationResult({
                text: '',
                sourceLang,
                targetLang,
                provider: this.name,
                error: googleError
            });
        }
    }

    async getSupportedLanguages() {
        if (this.supportedLanguages) {
            return this.supportedLanguages;
        }
        return await this.loadSupportedLanguages();
    }

    async testConnection() {
        try {
            const startTime = Date.now();

            // Тестовый перевод короткого текста
            const testText = 'Hello';
            const testResult = await this.translate(testText, 'en', 'ru');
            const responseTime = Date.now() - startTime;

            const success = !testResult.error && testResult.text.length > 0;

            return new ConnectionTestResult({
                success,
                message: success ? 'Google Translate API доступен' : 'Не удалось выполнить тестовый перевод',
                responseTime,
                details: {
                    provider: 'Google Cloud Translation',
                    projectId: this.projectId,
                    location: this.location,
                    testResult: success ? 'Успешно' : 'Ошибка'
                }
            });

        } catch (error) {
            this.logger.error('Google connection test failed:', error);

            return new ConnectionTestResult({
                success: false,
                message: this.getErrorMessage(error),
                responseTime: 0,
                details: {
                    error: error.response?.status || error.code,
                    provider: 'Google Cloud Translation'
                }
            });
        }
    }

    async validateApiKey(apiKey) {
        try {
            // Сохраняем текущий ключ
            const originalKey = this.apiKey;
            this.apiKey = apiKey;

            // Пытаемся получить список поддерживаемых языков
            const params = {
                key: apiKey,
                displayLanguageCode: 'ru'
            };

            if (this.projectId) {
                params.parent = `projects/${this.projectId}/locations/${this.location}`;
            }

            const response = await axios.get(`${this.apiBaseUrl}:supportedLanguages`, { params });
            const isValid = Array.isArray(response.data?.languages);

            // Восстанавливаем ключ
            this.apiKey = originalKey;

            return new ValidationResult({
                valid: isValid,
                message: isValid ? 'Ключ API действителен' : 'Неверный ключ API',
                details: {
                    provider: 'Google Cloud Translation',
                    validation: 'api_call',
                    languagesCount: response.data?.languages?.length || 0
                }
            });

        } catch (error) {
            this.logger.error('Google API key validation failed:', error);

            return new ValidationResult({
                valid: false,
                message: this.getErrorMessage(error),
                details: {
                    error: error.response?.status,
                    provider: 'Google Cloud Translation'
                }
            });
        }
    }

    // Вспомогательные методы

    async makeRequest(url, data = {}, params = {}) {
        const config = {
            method: 'POST',
            url,
            headers: {
                'Content-Type': 'application/json'
            },
            data,
            params,
            timeout: 10000
        };

        const response = await axios(config);
        return response.data;
    }

    async loadSupportedLanguages() {
        try {
            const params = {
                key: this.apiKey,
                displayLanguageCode: 'ru'
            };

            if (this.projectId) {
                params.parent = `projects/${this.projectId}/locations/${this.location}`;
            }

            const response = await axios.get(`${this.apiBaseUrl}:supportedLanguages`, { params });

            this.supportedLanguages = (response.data.languages || []).map(lang =>
                new Language({
                    code: lang.languageCode,
                    name: lang.displayName,
                    supportSource: lang.supportSource || false,
                    supportTarget: lang.supportTarget || false
                })
            );

            return this.supportedLanguages;

        } catch (error) {
            this.logger.error('Failed to load Google supported languages:', error);

            // Возвращаем базовый список в случае ошибки
            return this.getDefaultLanguages();
        }
    }

    mapGoogleError(error) {
        const status = error.response?.status;
        const message = error.response?.data?.error?.message || error.message;

        switch (status) {
            case 400:
                if (message?.includes('API key')) {
                    return new TranslationError({
                        type: 'INVALID_API_KEY',
                        message: 'Неверный API ключ',
                        details: message,
                        retryable: false
                    });
                }
                return new TranslationError({
                    type: 'INVALID_REQUEST',
                    message: 'Неверный запрос',
                    details: message,
                    retryable: false
                });

            case 403:
                if (message?.includes('disabled')) {
                    return new TranslationError({
                        type: 'INVALID_API_KEY',
                        message: 'API ключ отключен',
                        details: message,
                        retryable: false
                    });
                }
                if (message?.includes('quota')) {
                    return new TranslationError({
                        type: 'QUOTA_EXCEEDED',
                        message: 'Превышена квота API',
                        details: message,
                        retryable: true
                    });
                }
                return new TranslationError({
                    type: 'INVALID_API_KEY',
                    message: 'Доступ запрещен',
                    details: message,
                    retryable: false
                });

            case 429:
                return new TranslationError({
                    type: 'RATE_LIMITED',
                    message: 'Превышен лимит запросов',
                    details: message,
                    retryable: true
                });

            default:
                return new TranslationError({
                    type: 'PROVIDER_ERROR',
                    message: `Ошибка Google Translate API: ${message || 'Неизвестная ошибка'}`,
                    details: { status, message },
                    retryable: true
                });
        }
    }

    getErrorMessage(error) {
        if (error.response) {
            const googleError = error.response.data?.error;

            if (googleError) {
                switch (googleError.status) {
                    case 'INVALID_ARGUMENT':
                        return 'Неверные параметры запроса';
                    case 'PERMISSION_DENIED':
                        return 'Доступ запрещен. Проверьте API ключ';
                    case 'RESOURCE_EXHAUSTED':
                        return 'Превышен лимит запросов или квота';
                    case 'UNAUTHENTICATED':
                        return 'Требуется аутентификация';
                    default:
                        return googleError.message || `Ошибка API: ${error.response.status}`;
                }
            }
            return `Ошибка API: ${error.response.status}`;
        }
        return error.message || 'Неизвестная ошибка';
    }

    getDefaultLanguages() {
        return [
            new Language({ code: 'en', name: 'Английский', nativeName: 'English' }),
            new Language({ code: 'ru', name: 'Русский', nativeName: 'Русский' }),
            new Language({ code: 'es', name: 'Испанский', nativeName: 'Español' }),
            new Language({ code: 'fr', name: 'Французский', nativeName: 'Français' }),
            new Language({ code: 'de', name: 'Немецкий', nativeName: 'Deutsch' }),
            new Language({ code: 'zh', name: 'Китайский', nativeName: '中文' }),
            new Language({ code: 'ja', name: 'Японский', nativeName: '日本語' }),
            new Language({ code: 'ko', name: 'Корейский', nativeName: '한국어' }),
            new Language({ code: 'ar', name: 'Арабский', nativeName: 'العربية', direction: 'rtl' }),
            new Language({ code: 'pt', name: 'Португальский', nativeName: 'Português' }),
            new Language({ code: 'it', name: 'Итальянский', nativeName: 'Italiano' }),
            new Language({ code: 'hi', name: 'Хинди', nativeName: 'हिन्दी' }),
            new Language({ code: 'tr', name: 'Турецкий', nativeName: 'Türkçe' })
        ];
    }
}

module.exports = GoogleTranslationProvider;