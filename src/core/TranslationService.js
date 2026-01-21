const axios = require('axios');
const Logger = require('../utils/Logger');

/**
 * Сервис перевода текста
 * Отвечает за взаимодействие с API перевода
 */
class TranslationService {
    constructor() {
        this.logger = new Logger('TranslationService');
        this.apiClient = null;
        this.cache = new Map();
        this.maxCacheSize = 100;
        this.initializeApiClient();
    }

    /**
     * Инициализирует API клиент
     */
    initializeApiClient() {
        this.apiClient = axios.create({
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Electron-Translator/1.0.0'
            }
        });

        // Добавляем перехватчик для логирования
        this.apiClient.interceptors.request.use(
            (config) => {
                this.logger.debug(`API Request: ${config.method.toUpperCase()} ${config.url}`);
                return config;
            },
            (error) => {
                this.logger.error('API Request error:', error);
                return Promise.reject(error);
            }
        );
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

        // Проверяем кэш
        const cacheKey = this.getCacheKey(text, sourceLang, targetLang);
        const cached = this.cache.get(cacheKey);
        if (cached) {
            this.logger.debug('Translation from cache');
            return { translatedText: cached };
        }

        try {
            // TODO: Заменить на реальный API
            // Пример для Google Translate API (нужен API ключ)
            // const response = await this.apiClient.post(
            //   'https://translation.googleapis.com/language/translate/v2',
            //   {
            //     q: text,
            //     source: sourceLang === 'auto' ? '' : sourceLang,
            //     target: targetLang,
            //     format: 'text'
            //   },
            //   {
            //     params: {
            //       key: process.env.GOOGLE_TRANSLATE_API_KEY
            //     }
            //   }
            // );

            // Временная заглушка
            const translatedText = await this.getMockTranslation(text, sourceLang, targetLang);

            // Сохраняем в кэш
            this.addToCache(cacheKey, translatedText);

            return { translatedText };

        } catch (error) {
            this.logger.error('Translation API error:', error);

            // Fallback на моковый перевод при ошибке
            const fallbackTranslation = await this.getMockTranslation(text, sourceLang, targetLang);

            return {
                translatedText: fallbackTranslation,
                error: error.message || 'Translation error'
            };
        }
    }

    /**
     * Генерирует ключ для кэша
     */
    getCacheKey(text, sourceLang, targetLang) {
        return `${text}|${sourceLang}|${targetLang}`;
    }

    /**
     * Добавляет перевод в кэш
     */
    addToCache(key, translation) {
        if (this.cache.size >= this.maxCacheSize) {
            // Удаляем самый старый элемент
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, translation);
    }

    /**
     * Генерирует моковый перевод для тестирования
     */
    async getMockTranslation(text, sourceLang, targetLang) {
        // Имитация задержки сети
        await new Promise(resolve => setTimeout(resolve, 100));

        const languages = {
            'en': 'английский',
            'ru': 'русский',
            'es': 'испанский',
            'fr': 'французский',
            'de': 'немецкий',
            'zh': 'китайский',
            'ja': 'японский',
            'ko': 'корейский',
            'auto': 'автоопределение'
        };

        const sourceName = languages[sourceLang] || sourceLang;
        const targetName = languages[targetLang] || targetLang;

        return `[Перевод с ${sourceName} на ${targetName}]: ${text}`;
    }

    /**
     * Очищает кэш переводов
     */
    clearCache() {
        this.cache.clear();
        this.logger.info('Translation cache cleared');
    }

    /**
     * Возвращает статистику кэша
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize
        };
    }
}

module.exports = TranslationService;