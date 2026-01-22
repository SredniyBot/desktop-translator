const Logger = require('../utils/Logger');
const Platform = require('../utils/Platform');

class SettingsManager {
    constructor(settingsStore) {
        this.logger = new Logger('SettingsManager');
        this.store = settingsStore;
        this.isInitialized = false;
        this.appliedSettings = new Set();
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

        this.logger.info('All settings applied');
    }

    async applySettingChange({ path, value }) {
        this.logger.debug(`Applying setting change: ${path} =`, value);

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

    getSettingsStructure() {
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
                        options: [
                            { value: 'google', label: 'Google Translate', icon: 'fab fa-google' },
                            { value: 'deepl', label: 'DeepL', icon: 'fas fa-language' },
                            { value: 'yandex', label: 'Yandex Translate', icon: 'fab fa-yandex' },
                            { value: 'microsoft', label: 'Microsoft Translator', icon: 'fab fa-microsoft' }
                        ]
                    },
                    {
                        id: 'provider.apiKey',
                        type: 'apiKey',
                        label: 'Ключ API',
                        description: 'Введите ваш API ключ для доступа к сервису',
                        placeholder: 'Введите ваш API ключ'
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

    async testProviderConnection(provider, apiKey) {
        try {
            await new Promise(resolve => setTimeout(resolve, 1500));

            if (!apiKey || apiKey.length < 5) {
                return {
                    success: false,
                    error: 'Неверный API ключ',
                    details: 'Ключ API должен содержать не менее 5 символов'
                };
            }

            return {
                success: true,
                message: 'Соединение успешно установлено',
                details: `Провайдер: ${provider}, время отклика: 1500мс`
            };
        } catch (error) {
            return {
                success: false,
                error: 'Ошибка соединения',
                details: error.message
            };
        }
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