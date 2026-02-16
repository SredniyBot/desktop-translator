// File: src/core/translation/TranslationContext.js

class TranslationContext {
    constructor(primaryLang, defaultForeignLang, timeoutMinutes = 60) {
        this.primary = primaryLang || 'ru';
        this.defaultForeign = defaultForeignLang || 'en';
        this.timeoutMs = timeoutMinutes * 60 * 1000;

        this.currentSource = this.primary;
        this.currentTarget = this.defaultForeign;
        this.lastForeign = this.defaultForeign;

        this.lastActivity = Date.now();
    }

    updateConfig(primary, secondary, timeout) {
        if (primary) this.primary = primary;

        if (secondary) {
            const oldDefault = this.defaultForeign;
            this.defaultForeign = secondary;

            if (this.lastForeign === oldDefault || this.isExpired()) {
                this.lastForeign = secondary;
            }

            if (this.currentTarget === oldDefault || this.isExpired()) {
                this.currentTarget = secondary;
            }
        }

        if (timeout) {
            this.timeoutMs = timeout * 60 * 1000;
        }
    }

    updateFromApiResult(detectedLang) {
        this.checkTimeout();
        this.touch();

        if (!detectedLang) {
            return false;
        }

        if (detectedLang === this.currentTarget) {
            this.currentSource = this.currentTarget;
            this.currentTarget = (this.currentTarget === this.primary) ? this.lastForeign : this.primary;
            return true;
        }

        this.currentSource = detectedLang;
        if (detectedLang !== this.primary) {
            this.lastForeign = detectedLang;
        }

        return false;
    }

    setManualPair(source, target) {
        this.touch();

        if (source && source !== 'auto') {
            this.currentSource = source;
            if (source !== this.primary) {
                this.lastForeign = source;
            }
        }

        if (target && target !== 'auto') {
            this.currentTarget = target;
            if (target !== this.primary) {
                this.lastForeign = target;
            }
        }
    }

    checkTimeout() {
        if (this.isExpired()) {
            this.currentSource = this.primary;
            this.currentTarget = this.defaultForeign;
            this.lastForeign = this.defaultForeign;
        }
    }

    isExpired() {
        return (Date.now() - this.lastActivity) > this.timeoutMs;
    }

    touch() {
        this.lastActivity = Date.now();
    }

    getCurrentPair() {
        return {
            source: this.currentSource,
            target: this.currentTarget
        };
    }
}

module.exports = TranslationContext;