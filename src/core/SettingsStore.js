const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');
const Logger = require('../utils/Logger');

/**
 * Хранилище настроек с поддержкой реактивности
 */
class SettingsStore extends EventEmitter {
    constructor(app) {
        super();
        this.logger = new Logger('SettingsStore');
        this.app = app;
        this.settings = null;
        this.settingsPath = null;
        this.isInitialized = false;
        this.debounceTimers = new Map();
    }

    /**
     * Инициализирует хранилище настроек
     */
    async initialize() {
        if (this.isInitialized) return;

        try {
            const userDataPath = this.app.getPath('userData');
            this.settingsPath = path.join(userDataPath, 'settings.json');
            await this.loadSettings();
            this.isInitialized = true;
            this.logger.info('Settings store initialized');
        } catch (error) {
            this.logger.error('Failed to initialize settings store:', error);
            throw error;
        }
    }

    /**
     * Возвращает настройки по умолчанию
     */
    getDefaultSettings() {
        return {
            version: '1.0.0',
            provider: {
                name: 'google',
                apiKey: '',
                apiUrl: 'https://translation.googleapis.com/language/translate/v2'
            },
            app: {
                autoStart: true,
                liveTranslation: true,
                hotkeys: [
                    { id: 'translate_selected', name: 'Перевод выделенного текста', key: 'Ctrl+Alt+Q' },
                    { id: 'open_translator', name: 'Открыть переводчик', key: 'Ctrl+C+C' }
                ]
            },
            customization: {
                theme: 'light',
                themeColor: 'indigo',
                accentColor: '#6366f1'
            }
        };
    }

    /**
     * Загружает настройки из файла
     */
    async loadSettings() {
        try {
            const data = await fs.readFile(this.settingsPath, 'utf8');
            const loadedSettings = JSON.parse(data);

            // Объединяем с настройками по умолчанию для новых полей
            this.settings = this.deepMerge(this.getDefaultSettings(), loadedSettings);

            this.logger.info('Settings loaded from file');
            this.emit('loaded', this.settings);
        } catch (error) {
            if (error.code === 'ENOENT') {
                this.settings = this.getDefaultSettings();
                await this.saveSettings();
                this.logger.info('Created default settings');
            } else {
                throw error;
            }
        }
    }

    /**
     * Сохраняет настройки в файл
     */
    async saveSettings() {
        try {
            const data = JSON.stringify(this.settings, null, 2);
            await fs.writeFile(this.settingsPath, data, 'utf8');
            this.logger.debug('Settings saved to file');
            this.emit('saved', this.settings);
            return true;
        } catch (error) {
            this.logger.error('Failed to save settings:', error);
            return false;
        }
    }

    /**
     * Получает значение настройки
     */
    get(path, defaultValue = null) {
        const parts = path.split('.');
        let current = this.settings;

        for (const part of parts) {
            if (current[part] === undefined) {
                return defaultValue;
            }
            current = current[part];
        }

        return current;
    }

    /**
     * Устанавливает значение настройки с автоматическим сохранением
     */
    async set(path, value, immediate = false) {
        const parts = path.split('.');
        let current = this.settings;

        // Находим родительский объект
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) {
                current[parts[i]] = {};
            }
            current = current[parts[i]];
        }

        const lastKey = parts[parts.length - 1];
        const oldValue = current[lastKey];

        // Если значение не изменилось, ничего не делаем
        if (JSON.stringify(oldValue) === JSON.stringify(value)) {
            return;
        }

        // Устанавливаем новое значение
        current[lastKey] = value;

        // Отправляем событие об изменении
        this.emit('changed', { path, value, oldValue });
        this.emit(`changed:${path}`, value, oldValue);

        // Сохраняем с дебаунсом
        if (immediate) {
            await this.saveSettings();
        } else {
            this.debouncedSave();
        }
    }

    /**
     * Обновляет несколько настроек одновременно
     */
    async update(updates, immediate = false) {
        for (const [path, value] of Object.entries(updates)) {
            await this.set(path, value, true);
        }

        if (!immediate) {
            this.debouncedSave();
        }
    }

    /**
     * Дебаунс сохранения настроек
     */
    debouncedSave() {
        if (this.debounceTimers.has('save')) {
            clearTimeout(this.debounceTimers.get('save'));
        }

        const timer = setTimeout(async () => {
            await this.saveSettings();
            this.debounceTimers.delete('save');
        }, 500);

        this.debounceTimers.set('save', timer);
    }

    /**
     * Сбрасывает настройки к значениям по умолчанию
     */
    async reset() {
        this.settings = this.getDefaultSettings();
        await this.saveSettings();
        this.emit('reset', this.settings);
        return true;
    }

    /**
     * Возвращает все настройки
     */
    getAll() {
        return { ...this.settings };
    }

    /**
     * Глубокое слияние объектов
     */
    deepMerge(target, source) {
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!target[key] || typeof target[key] !== 'object') {
                    target[key] = {};
                }
                this.deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
        return target;
    }

    /**
     * Очищает ресурсы
     */
    cleanup() {
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
        this.removeAllListeners();
        this.isInitialized = false;
    }
}

module.exports = SettingsStore;