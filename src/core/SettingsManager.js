// File: src/core/SettingsManager.js
const Logger = require('../utils/Logger');
const Platform = require('../utils/Platform');

class SettingsManager {
    constructor(settingsStore) {
        this.logger = new Logger('SettingsManager');
        this.store = settingsStore;
        this.isInitialized = false;
        this.appliedSettings = new Set();
        this.translationManager = null;
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            this.store.on('changed', (change) => this.applySettingChange(change));
            this.store.on('loaded', (settings) => this.applyAllSettings(settings));

            const settings = this.store.getAll();
            await this.applyAllSettings(settings);

            this.isInitialized = true;
            this.logger.info('Settings manager initialized');
        } catch (error) {
            this.logger.error('Failed to initialize settings manager:', error);
            throw error;
        }
    }

    async applyAllSettings(settings) {
        this.logger.info('Applying all settings');
        await this.applyAutoStart(settings.app?.autoStart);
        await this.applyTheme(settings.customization?.theme);
        await this.applyThemeColor(settings.customization?.themeColor);

        if (this.translationManager) {
            await this.applyTranslationProvider(settings.provider);
            if (this.translationManager.initializeContext) {
                this.translationManager.initializeContext();
            }
        }

        this.logger.info('All settings applied');
    }

    async applySettingChange({ path, value }) {
        this.logger.debug(`Applying setting change: ${path} =`, value);

        if (path.startsWith('provider.config.')) {
            await this.applyTranslationProvider(this.store.getAll().provider);
            this.appliedSettings.add(path);
            return;
        }

        if (path.startsWith('translation.') && this.translationManager) {
            this.translationManager.initializeContext();
        }

        switch (path) {
            case 'app.autoStart':
                await this.applyAutoStart(value);
                break;

            case 'customization.theme':
                await this.applyTheme(value);
                break;

            case 'customization.themeColor':
                await this.applyThemeColor(value);
                break;

            case 'app.hotkeys':
                await this.applyHotkeys(value);
                break;

            case 'provider.name':
            case 'provider.apiKey':
                await this.applyTranslationProvider(this.store.getAll().provider);
                break;

            default:
                this.logger.debug(`No specific handler for setting: ${path}`);
        }

        this.appliedSettings.add(path);
    }

    async applyAutoStart(enabled) {
        try {
            const { app } = require('electron');
            app.setLoginItemSettings({
                openAtLogin: enabled,
                openAsHidden: false
            });
            this.logger.info(`Auto-start ${enabled ? 'enabled' : 'disabled'}`);
        } catch (error) {
            this.logger.error('Failed to apply auto-start setting:', error);
        }
    }

    async applyTheme(theme) {
        try {
            const mainWindow = require('electron').BrowserWindow.getAllWindows()[0];
            if (mainWindow) {
                mainWindow.webContents.send('theme-changed', theme);
            }
            this.logger.info(`Theme applied: ${theme}`);
        } catch (error) {
            this.logger.error('Failed to apply theme:', error);
        }
    }

    async applyThemeColor(color) {
        try {
            const mainWindow = require('electron').BrowserWindow.getAllWindows()[0];
            if (mainWindow) {
                mainWindow.webContents.send('theme-color-changed', color);
            }
            this.logger.info(`Theme color applied: ${color}`);
        } catch (error) {
            this.logger.error('Failed to apply theme color:', error);
        }
    }

    async applyHotkeys(hotkeys) {
        try {
            this.logger.info('Hotkeys applied:', hotkeys?.length || 0);
        } catch (error) {
            this.logger.error('Failed to apply hotkeys:', error);
        }
    }

    async applyTranslationProvider(providerSettings) {
        if (!this.translationManager) {
            this.logger.warn('Translation manager not available, skipping provider application');
            return;
        }

        try {
            const { name, apiKey } = providerSettings;
            const config = this.store.getProviderConfig(name);

            await this.translationManager.switchProvider(name, apiKey, config);
            this.logger.info(`Translation provider switched to: ${name}`);

            const mainWindow = require('electron').BrowserWindow.getAllWindows()[0];
            if (mainWindow) {
                mainWindow.webContents.send('provider-changed', { name, config });
            }

        } catch (error) {
            this.logger.error('Failed to apply translation provider:', error);
            if (providerSettings.name !== 'mock') {
                this.logger.warn('Falling back to mock provider');
                await this.translationManager.switchProvider('mock', '', {});
            }
        }
    }

    setTranslationManager(translationManager) {
        this.translationManager = translationManager;
        if (this.translationManager.setSettingsStore) {
            this.translationManager.setSettingsStore(this.store);
        }
    }

    async getSettingsStructure() {
        const providers = this.translationManager ?
            this.translationManager.getAvailableProviders() :
            [];

        const providerOptions = providers.map(p => ({
            value: p.name,
            label: p.label,
            icon: p.icon
        }));

        const providerConfigSettings = [];
        providers.forEach(provider => {
            if (provider.configFields) {
                provider.configFields.forEach(field => {
                    providerConfigSettings.push({
                        id: `provider.config.${provider.name}.${field.id}`,
                        type: field.type,
                        label: `${field.label}`,
                        description: field.description,
                        placeholder: field.placeholder,
                        defaultValue: field.defaultValue,
                        dependsOn: 'provider.name',
                        showFor: [provider.name],
                        required: field.required
                    });
                });
            }
        });

        let languageOptions = [];
        if (this.translationManager) {
            const supportedLanguages = await this.translationManager.getSupportedLanguages();
            languageOptions = supportedLanguages.map(lang => ({
                value: lang.code,
                label: lang.name
            }));
        }

        if (languageOptions.length === 0) {
            languageOptions = [
                { value: 'en', label: 'Английский' },
                { value: 'ru', label: 'Русский' }
            ];
        }

        return [
            {
                id: 'provider',
                title: 'Провайдер перевода',
                icon: 'fas fa-server',
                description: 'Настройки API для перевода текста',
                settings: [
                    {
                        id: 'provider.name',
                        type: 'select',
                        label: 'Провайдер',
                        description: 'Выберите сервис перевода',
                        options: providerOptions
                    },
                    {
                        id: 'provider.apiKey',
                        type: 'apiKey',
                        label: 'Ключ API',
                        description: 'Введите ваш API ключ',
                        placeholder: 'Введите ваш API ключ',
                        required: true,
                        dependsOn: 'provider.name',
                        hideFor: ['mock']
                    },
                    ...providerConfigSettings
                ]
            },
            {
                id: 'translation',
                title: 'Настройки перевода',
                icon: 'fas fa-language',
                description: 'Параметры языков по умолчанию',
                settings: [
                    {
                        id: 'translation.primaryLanguage',
                        type: 'select',
                        label: 'Родной язык (Primary)',
                        description: 'Ваш основной язык',
                        options: languageOptions
                    },
                    {
                        id: 'translation.secondLanguage',
                        type: 'select',
                        label: 'Иностранный по умолчанию',
                        description: 'Язык, который будет выбран при запуске',
                        options: languageOptions
                    }
                ]
            },
            {
                id: 'app',
                title: 'Работа приложения',
                icon: 'fas fa-cogs',
                description: 'Настройки поведения приложения',
                settings: [
                    {
                        id: 'app.autoStart',
                        type: 'toggle',
                        label: 'Автозапуск при старте системы',
                        description: 'Запускать приложение автоматически при входе в систему'
                    },
                    {
                        id: 'app.liveTranslation',
                        type: 'toggle',
                        label: 'Live перевод при печати',
                        description: 'Автоматически переводить текст во время ввода'
                    },
                    {
                        id: 'app.cacheTranslations',
                        type: 'toggle',
                        label: 'Кэшировать переводы',
                        description: 'Сохранять переводы в кэше для быстрого доступа'
                    },
                    {
                        id: 'app.translationHistory',
                        type: 'toggle',
                        label: 'История переводов',
                        description: 'Сохранять историю выполненных переводов'
                    }
                ]
            },
            {
                id: 'hotkeys',
                title: 'Горячие клавиши',
                icon: 'fas fa-keyboard',
                description: 'Настройка сочетаний клавиш для быстрого доступа',
                settings: [
                    {
                        id: 'app.hotkeys',
                        type: 'list',
                        label: 'Назначение клавиш',
                        description: 'Добавьте или измените горячие клавиши',
                        items: this.store.get('app.hotkeys', []),
                        canAdd: true,
                        canEdit: true,
                        canDelete: true,
                        columns: [
                            { key: 'name', label: 'Действие', width: '60%' },
                            { key: 'key', label: 'Сочетание', width: '40%' }
                        ]
                    }
                ]
            },
            {
                id: 'customization',
                title: 'Внешний вид',
                icon: 'fas fa-paint-brush',
                description: 'Настройки интерфейса и темы',
                settings: [
                    {
                        id: 'customization.theme',
                        type: 'toggle',
                        label: 'Темная тема',
                        description: 'Включить темную тему интерфейса',
                        valueOn: 'dark',
                        valueOff: 'light'
                    },
                    {
                        id: 'customization.themeColor',
                        type: 'color',
                        label: 'Цвет темы',
                        description: 'Выберите основной цвет интерфейса',
                        options: [
                            { value: 'indigo', color: '#6366f1', label: 'Индиго' },
                            { value: 'blue', color: '#3b82f6', label: 'Синий' },
                            { value: 'emerald', color: '#10b981', label: 'Изумрудный' },
                            { value: 'purple', color: '#8b5cf6', label: 'Фиолетовый' },
                            { value: 'rose', color: '#f43f5e', label: 'Розовый' },
                            { value: 'amber', color: '#f59e0b', label: 'Янтарный' },
                            { value: 'slate', color: '#64748b', label: 'Серый' }
                        ]
                    }
                ]
            }
        ];
    }

    async testProviderConnection(provider, apiKey, config = {}) {
        try {
            if (!this.translationManager) {
                return {
                    success: false,
                    error: 'Translation manager not available',
                    details: 'Попробуйте перезапустить приложение'
                };
            }

            const result = await this.translationManager.testProviderConnection(provider, apiKey, config);
            return result;

        } catch (error) {
            this.logger.error('Provider connection test failed:', error);
            return {
                success: false,
                error: error.message || 'Ошибка соединения',
                details: 'Не удалось установить соединение с провайдером'
            };
        }
    }

    async getTranslationHistory() {
        if (!this.translationManager) {
            return [];
        }
        return this.translationManager.getTranslationHistory();
    }

    async clearTranslationHistory() {
        if (!this.translationManager) {
            return false;
        }
        this.translationManager.clearHistory();
        return true;
    }

    getSettings() {
        return this.store.getAll();
    }

    cleanup() {
        this.store.removeAllListeners();
        this.appliedSettings.clear();
        this.isInitialized = false;
    }
}

module.exports = SettingsManager;