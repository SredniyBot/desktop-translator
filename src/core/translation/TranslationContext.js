// File: src/core/translation/TranslationContext.js
const Logger = require('../../utils/Logger');

/**
 * Класс, хранящий состояние сессии перевода.
 * Отвечает за логику "липкости" иностранного языка и автоматическую смену направления.
 */
class TranslationContext {
    /**
     * @param {string} primaryLang - Родной язык пользователя (например, 'ru')
     * @param {string} defaultForeignLang - Иностранный язык по умолчанию (например, 'en')
     * @param {number} timeoutMinutes - Время жизни сессии в минутах
     */
    constructor(primaryLang, defaultForeignLang, timeoutMinutes = 60) {
        this.logger = new Logger('TranslationContext');

        this.primary = primaryLang || 'ru';
        this.defaultForeign = defaultForeignLang || 'en';
        this.timeoutMs = timeoutMinutes * 60 * 1000;

        // Состояние сессии
        this.currentSource = 'auto';
        this.currentTarget = this.defaultForeign;

        // "Липкий" иностранный язык. Запоминает последний использованный не-родной язык.
        // Пример: если переводили с DE, тут будет храниться 'de'.
        this.lastForeign = this.defaultForeign;

        this.lastActivity = Date.now();
    }

    /**
     * Обновляет конфигурацию контекста при изменении настроек
     */
    updateConfig(primary, secondary, timeout) {
        if (primary) this.primary = primary;
        if (secondary) {
            // Если дефолтный язык сменился, и текущая сессия протухла — обновляем lastForeign
            const oldDefault = this.defaultForeign;
            this.defaultForeign = secondary;

            if (this.lastForeign === oldDefault || this.isExpired()) {
                this.lastForeign = secondary;
            }
        }
        if (timeout) this.timeoutMs = timeout * 60 * 1000;
    }

    /**
     * Сценарий 1: Пользователь вставил новый текст (или вызвал перевод выделенного).
     * Это "Внешний триггер", который может сбросить или переопределить контекст.
     */
    handleExternalInput(detectedLang) {
        this.checkTimeout();
        this.touch();

        if (!detectedLang) return;

        // 1. Входящий текст на Родном языке (RU)
        if (detectedLang === this.primary) {
            // Пользователь хочет перевести С Родного НА Иностранный.
            // Используем запомненный последний иностранный (или дефолтный)
            this.currentSource = this.primary;
            this.currentTarget = this.lastForeign;

            this.logger.debug(`External Input (Primary): Set ${this.currentSource} -> ${this.currentTarget}`);
        }
        // 2. Входящий текст на Иностранном (DE, EN, FR...)
        else {
            // Пользователь хочет перевести С Иностранного НА Родной.
            this.currentSource = detectedLang;
            this.currentTarget = this.primary;

            // Запоминаем этот язык как активный иностранный для этой сессии
            this.lastForeign = detectedLang;

            this.logger.debug(`External Input (Foreign): Set ${this.currentSource} -> ${this.currentTarget}. LastForeign updated to ${this.lastForeign}`);
        }
    }

    /**
     * Сценарий 2: Пользователь редактирует текст в окне (Live Typing).
     * Мы должны понять, не сменил ли он язык ввода, и если да — перевернуть направление.
     */
    handleInputUpdate(detectedLang) {
        this.checkTimeout();
        this.touch();

        if (!detectedLang) return;

        // Кейс: Было DE -> RU. Пользователь стер и пишет на RU.
        // detected (RU) совпадает с currentTarget (RU).
        if (detectedLang === this.currentTarget) {
            this.logger.debug('Context SWAP: User started typing in Target language');

            // Логика переворота (SWAP)
            this.currentSource = detectedLang; // Теперь Source = RU

            // Target должен стать тем языком, с которого мы переводили ранее.
            // Обычно это хранится в lastForeign.
            // Но делаем проверку: если новый source == primary, то target = lastForeign.
            // Если новый source == foreign, то target = primary.

            if (detectedLang === this.primary) {
                this.currentTarget = this.lastForeign;
            } else {
                this.currentTarget = this.primary;
            }
        }

            // Кейс: Было RU -> DE. Пользователь стер и пишет на DE.
        // detected (DE) совпадает с lastForeign, но текущий source был RU.
        else if (detectedLang === this.lastForeign && this.currentSource !== this.lastForeign) {
            this.logger.debug('Context Correction: User switched back to Foreign language');
            this.currentSource = this.lastForeign;
            this.currentTarget = this.primary;
        }
    }

    /**
     * Проверяет таймаут сессии. Если время вышло — сбрасывает состояние.
     */
    checkTimeout() {
        if (this.isExpired()) {
            this.logger.info('Translation session expired (Timeout). Resetting context to defaults.');
            this.lastForeign = this.defaultForeign;
            this.currentSource = 'auto';
            this.currentTarget = this.defaultForeign;
        }
    }

    isExpired() {
        return (Date.now() - this.lastActivity) > this.timeoutMs;
    }

    touch() {
        this.lastActivity = Date.now();
    }

    /**
     * Возвращает текущую рассчитанную пару языков
     */
    getCurrentPair() {
        return {
            source: this.currentSource,
            target: this.currentTarget
        };
    }
}

module.exports = TranslationContext;