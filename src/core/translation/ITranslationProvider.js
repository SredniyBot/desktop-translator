/**
 * Интерфейс провайдера перевода
 * Все конкретные провайдеры должны реализовывать этот интерфейс
 */
class ITranslationProvider {
    constructor(config = {}) {
        if (this.constructor === ITranslationProvider) {
            throw new Error('ITranslationProvider is abstract and cannot be instantiated');
        }
        this.config = config;
    }

    /**
     * Уникальное имя провайдера (геттер, должен быть переопределен)
     */
    get name() {
        throw new Error('Getter "name" must be implemented');
    }

    /**
     * Инициализация провайдера
     * @param {string} apiKey - API ключ
     * @returns {Promise<void>}
     */
    async initialize(apiKey) {
        throw new Error('Method "initialize" must be implemented');
    }

    /**
     * Выполнение перевода
     * @param {string} text - Текст для перевода
     * @param {string} sourceLang - Исходный язык (код)
     * @param {string} targetLang - Целевой язык (код)
     * @returns {Promise<TranslationResult>}
     */
    async translate(text, sourceLang, targetLang) {
        throw new Error('Method "translate" must be implemented');
    }

    /**
     * Получение списка поддерживаемых языков
     * @returns {Promise<Language[]>}
     */
    async getSupportedLanguages() {
        throw new Error('Method "getSupportedLanguages" must be implemented');
    }

    /**
     * Проверка доступности провайдера
     * @returns {Promise<ConnectionTestResult>}
     */
    async testConnection() {
        throw new Error('Method "testConnection" must be implemented');
    }

    /**
     * Проверка валидности API ключа
     * @param {string} apiKey - API ключ для проверки
     * @returns {Promise<ValidationResult>}
     */
    async validateApiKey(apiKey) {
        throw new Error('Method "validateApiKey" must be implemented');
    }
}

/**
 * Результат перевода
 */
class TranslationResult {
    constructor({
                    text = '',
                    sourceLang = '',
                    targetLang = '',
                    provider = '',
                    detectedLanguage = null,
                    confidence = null,
                    error = null
                } = {}) {
        this.text = text;
        this.sourceLang = sourceLang;
        this.targetLang = targetLang;
        this.provider = provider;
        this.detectedLanguage = detectedLanguage;
        this.confidence = confidence;
        this.error = error;
        this.timestamp = Date.now();
    }
}

/**
 * Поддерживаемый язык
 */
class Language {
    constructor({ code, name, nativeName, direction = 'ltr' } = {}) {
        this.code = code;
        this.name = name;
        this.nativeName = nativeName;
        this.direction = direction;
    }
}

/**
 * Результат проверки соединения
 */
class ConnectionTestResult {
    constructor({ success = false, message = '', responseTime = 0, details = null } = {}) {
        this.success = success;
        this.message = message;
        this.responseTime = responseTime;
        this.details = details;
    }
}

/**
 * Результат валидации
 */
class ValidationResult {
    constructor({ valid = false, message = '', details = null } = {}) {
        this.valid = valid;
        this.message = message;
        this.details = details;
    }
}

/**
 * Типы ошибок перевода
 */
const TranslationErrorType = {
    INVALID_API_KEY: 'INVALID_API_KEY',
    QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
    UNSUPPORTED_LANGUAGE: 'UNSUPPORTED_LANGUAGE',
    NETWORK_ERROR: 'NETWORK_ERROR',
    PROVIDER_ERROR: 'PROVIDER_ERROR',
    INVALID_REQUEST: 'INVALID_REQUEST',
    RATE_LIMITED: 'RATE_LIMITED'
};

/**
 * Ошибка перевода
 */
class TranslationError {
    constructor({ type = TranslationErrorType.PROVIDER_ERROR, message = '', details = null, retryable = false } = {}) {
        this.type = type;
        this.message = message;
        this.details = details;
        this.retryable = retryable;
        this.timestamp = Date.now();
    }
}

module.exports = {
    ITranslationProvider,
    TranslationResult,
    Language,
    ConnectionTestResult,
    ValidationResult,
    TranslationErrorType,
    TranslationError
};