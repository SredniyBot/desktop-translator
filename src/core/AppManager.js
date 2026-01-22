const WindowManager = require('./WindowManager');
const HotkeyManager = require('./HotkeyManager');
const TrayManager = require('./TrayManager');
const TranslationService = require('./TranslationService');
const TextSelectionService = require('./TextSelectionService');
const SettingsStore = require('./SettingsStore');
const SettingsManager = require('./SettingsManager');
const Logger = require('../utils/Logger');

class AppManager {
    constructor() {
        this.logger = new Logger('AppManager');
        this.components = {};
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            this.logger.info('Initializing application components...');

            // Инициализируем хранилище настроек
            const { app } = require('electron');
            this.components.settingsStore = new SettingsStore(app);
            await this.components.settingsStore.initialize();

            // Инициализируем менеджер настроек
            this.components.settingsManager = new SettingsManager(this.components.settingsStore);
            await this.components.settingsManager.initialize();

            // Остальные компоненты
            this.components.translationService = new TranslationService();
            this.components.textSelectionService = new TextSelectionService();
            this.components.windowManager = new WindowManager();

            this.components.hotkeyManager = new HotkeyManager({
                windowManager: this.components.windowManager,
                textSelectionService: this.components.textSelectionService,
                settingsStore: this.components.settingsStore
            });

            this.components.trayManager = new TrayManager({
                windowManager: this.components.windowManager,
                settingsStore: this.components.settingsStore
            });

            // Запуск компонентов
            await this.components.windowManager.initialize();
            await this.components.hotkeyManager.initialize();
            await this.components.trayManager.initialize();

            this.components.textSelectionService.diagnoseSystem();

            this.isInitialized = true;
            this.logger.info('Application initialized successfully');

        } catch (error) {
            this.logger.error('Failed to initialize application:', error);
            throw error;
        }
    }

    get windowManager() {
        return this.components.windowManager;
    }

    get translationService() {
        return this.components.translationService;
    }

    get settingsStore() {
        return this.components.settingsStore;
    }

    get settingsManager() {
        return this.components.settingsManager;
    }

    cleanup() {
        this.logger.info('Cleaning up application...');

        if (this.components.hotkeyManager) {
            this.components.hotkeyManager.cleanup();
        }

        if (this.components.settingsStore) {
            this.components.settingsStore.cleanup();
        }

        if (this.components.settingsManager) {
            this.components.settingsManager.cleanup();
        }

        this.components = {};
        this.isInitialized = false;
    }
}

module.exports = AppManager;