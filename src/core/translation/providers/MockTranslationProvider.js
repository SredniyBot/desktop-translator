const { ITranslationProvider, TranslationResult, Language, ConnectionTestResult, ValidationResult } = require('../ITranslationProvider');
const Logger = require('../../../utils/Logger'); // Исправленный путь

/**
 * Mock провайдер перевода для тестирования
 * Имитирует работу реального API без сетевых запросов
 */
class MockTranslationProvider extends ITranslationProvider {
    constructor(config = {}) {
        super(config);
        this.logger = new Logger('MockTranslationProvider');
        this.apiKey = null;
        this.supportedLanguages = this.generateLanguageList();
    }

    get name() {
        return 'mock';
    }

    async initialize(apiKey) {
        this.apiKey = apiKey;
        this.logger.info('Mock translation provider initialized');
        return Promise.resolve();
    }

    async translate(text, sourceLang, targetLang) {
        // Имитация сетевой задержки (100-500ms)
        const delay = Math.floor(Math.random() * 400) + 100;
        await new Promise(resolve => setTimeout(resolve, delay));

        // Валидация
        if (!text || !text.trim()) {
            return new TranslationResult({
                text: '',
                provider: this.name,
                error: { type: 'INVALID_REQUEST', message: 'Текст для перевода не может быть пустым' }
            });
        }

        // Определение языка (если auto)
        const detectedLang = sourceLang === 'auto' ? this.detectLanguage(text) : sourceLang;

        // Генерация перевода
        const translatedText = this.generateTranslation(text, detectedLang, targetLang);

        return new TranslationResult({
            text: translatedText,
            sourceLang: detectedLang,
            targetLang,
            provider: this.name,
            detectedLanguage: sourceLang === 'auto' ? detectedLang : null,
            confidence: sourceLang === 'auto' ? Math.random() * 0.3 + 0.7 : null
        });
    }

    async getSupportedLanguages() {
        return this.supportedLanguages;
    }

    async testConnection() {
        const responseTime = Math.floor(Math.random() * 200) + 50;

        if (!this.apiKey) {
            return new ConnectionTestResult({
                success: false,
                message: 'API ключ не указан',
                responseTime
            });
        }

        return new ConnectionTestResult({
            success: true,
            message: 'Mock провайдер готов к работе',
            responseTime,
            details: {
                provider: 'Mock Translator',
                mode: 'Тестовый режим',
                languages: this.supportedLanguages.length
            }
        });
    }

    async validateApiKey(apiKey) {
        // Mock всегда валиден, но проверяем минимальную длину для реализма
        const isValid = apiKey && apiKey.length >= 5;

        return new ValidationResult({
            valid: isValid,
            message: isValid ? 'Ключ API действителен' : 'Ключ API должен содержать не менее 5 символов',
            details: {
                provider: 'Mock Translator',
                validation: 'simulated'
            }
        });
    }

    // Вспомогательные методы

    generateLanguageList() {
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
            new Language({ code: 'tr', name: 'Турецкий', nativeName: 'Türkçe' }),
            new Language({ code: 'nl', name: 'Голландский', nativeName: 'Nederlands' }),
            new Language({ code: 'pl', name: 'Польский', nativeName: 'Polski' }),
            new Language({ code: 'sv', name: 'Шведский', nativeName: 'Svenska' }),
            new Language({ code: 'fi', name: 'Финский', nativeName: 'Suomi' })
        ];
    }

    detectLanguage(text) {
        // Простая эвристика для определения языка
        const textLower = text.toLowerCase();

        if (/[а-яё]/.test(textLower)) return 'ru';
        if (/[a-z]/.test(textLower)) {
            if (/\bthe\b|\ban\b|\ba\b/.test(textLower)) return 'en';
            if (/\bder\b|\bdas\b|\bdie\b/.test(textLower)) return 'de';
            if (/\ble\b|\bla\b|\bun\b|\bune\b/.test(textLower)) return 'fr';
            if (/\bel\b|\bla\b|\bun\b|\buna\b/.test(textLower)) return 'es';
        }
        if (/[ぁ-んァ-ン]/.test(text)) return 'ja';
        if (/[一-龯]/.test(text)) return 'zh';
        if (/[가-힣]/.test(text)) return 'ko';

        return 'en';
    }

    generateTranslation(text, sourceLang, targetLang) {
        const languages = {
            'en': 'английский',
            'ru': 'русский',
            'es': 'испанский',
            'fr': 'французский',
            'de': 'немецкий',
            'zh': 'китайский',
            'ja': 'японский',
            'ko': 'корейский',
            'ar': 'арабский',
            'pt': 'португальский',
            'it': 'итальянский',
            'hi': 'хинди',
            'tr': 'турецкий',
            'nl': 'голландский',
            'pl': 'польский',
            'sv': 'шведский',
            'fi': 'финский'
        };

        const sourceName = languages[sourceLang] || sourceLang;
        const targetName = languages[targetLang] || targetLang;

        const mockPrefix = `[Mock перевод с ${sourceName} на ${targetName}]:`;

        if (text.length < 20) {
            return `${mockPrefix} "${text.toUpperCase()}"`;
        } else if (text.length < 100) {
            return `${mockPrefix} ${this.reverseWords(text)}`;
        } else {
            return `${mockPrefix} ${text.split(' ').map(word =>
                word.split('').reverse().join('')
            ).join(' ')}`;
        }
    }

    reverseWords(text) {
        return text.split(' ')
            .map(word => word.split('').reverse().join(''))
            .join(' ');
    }
}

module.exports = MockTranslationProvider;