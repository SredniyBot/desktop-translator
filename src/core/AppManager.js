const WindowManager = require('./WindowManager');
const HotkeyManager = require('./HotkeyManager');
const TrayManager = require('./TrayManager');
const TranslationService = require('./TranslationService');
const TextSelectionService = require('./TextSelectionService');
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

            this.components.translationService = new TranslationService();
            this.components.textSelectionService = new TextSelectionService();

            this.components.windowManager = new WindowManager();

            this.components.hotkeyManager = new HotkeyManager({
                windowManager: this.components.windowManager,
                textSelectionService: this.components.textSelectionService
            });

            this.components.trayManager = new TrayManager({
                windowManager: this.components.windowManager
            });

            // Запуск компонентов
            await this.components.windowManager.initialize();
            await this.components.hotkeyManager.initialize();
            await this.components.trayManager.initialize();

            // Настройка автозагрузки
            const { app } = require('electron');
            app.setLoginItemSettings({
                openAtLogin: true,
                openAsHidden: false
            });

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

    cleanup() {
        this.logger.info('Cleaning up application...');

        if (this.components.hotkeyManager) {
            this.components.hotkeyManager.cleanup();
        }

        this.components = {};
        this.isInitialized = false;
    }
}

module.exports = AppManager;