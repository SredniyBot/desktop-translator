// File: src/utils/LanguageUtils.js
const franc = require('franc');

/**
 * Утилиты для определения языка
 * Обертка над franc для преобразования ISO-639-3 в ISO-639-1
 */
class LanguageUtils {
    constructor() {
        // Карта ISO 639-3 (franc) -> ISO 639-1 (Yandex/Google)
        this.isoMap = {
            'eng': 'en', 'rus': 'ru', 'spa': 'es', 'fra': 'fr',
            'deu': 'de', 'zho': 'zh', 'cmn': 'zh', 'jpn': 'ja',
            'kor': 'ko', 'ita': 'it', 'tur': 'tr', 'ukr': 'uk',
            'arb': 'ar', 'por': 'pt', 'nld': 'nl', 'pol': 'pl',
            'bul': 'bg', 'ces': 'cs', 'dan': 'da', 'fin': 'fi',
            'ell': 'el', 'hun': 'hu', 'ind': 'id', 'lav': 'lv',
            'lit': 'lt', 'nno': 'no', 'nob': 'no', 'ron': 'ro',
            'slk': 'sk', 'slv': 'sl', 'swe': 'sv', 'tha': 'th',
            'vie': 'vi'
        };

        // Обратная карта для создания whitelist (оптимизация franc)
        this.reverseIsoMap = Object.entries(this.isoMap).reduce((acc, [key, value]) => {
            acc[value] = key;
            return acc;
        }, {});
    }

    /**
     * Определяет язык текста
     * @param {string} text - Текст для анализа
     * @param {Array<string>} priorityLanguages - Приоритетные языки ['ru', 'en']
     * @returns {string|null} 2-буквенный код языка или null
     */
    detectLanguage(text, priorityLanguages = []) {
        if (!text || text.length < 3) return null;

        // Базовый список распространенных языков + приоритетные
        const baseWhitelist = ['eng', 'rus', 'spa', 'fra', 'deu', 'zho', 'jpn'];

        const priorityIso3 = priorityLanguages
            .map(l => this.reverseIsoMap[l])
            .filter(Boolean);

        const whitelist = [...new Set([...priorityIso3, ...baseWhitelist])];

        // Запуск определения
        const results = franc.all(text, {
            minLength: 3,
            whitelist: whitelist
        });

        if (!results || results.length === 0) return null;

        const bestGuess = results[0]; // [code, score]
        const code3 = bestGuess[0];
        const score = bestGuess[1];

        // Для коротких текстов нужна высокая уверенность
        if (text.length < 10 && score < 0.75) {
            return null;
        }

        return this.isoMap[code3] || null;
    }
}

module.exports = new LanguageUtils();