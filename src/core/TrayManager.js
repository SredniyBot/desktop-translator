const { Tray, Menu, app } = require('electron');
const path = require('path');
const Logger = require('../utils/Logger');

class TrayManager {
    constructor({ windowManager } = {}) {
        this.logger = new Logger('TrayManager');
        this.windowManager = windowManager;
        this.tray = null;
    }

    async initialize() {
        try {
            this.createTray();
            this.logger.info('Tray manager initialized');
        } catch (error) {
            this.logger.error('Failed to initialize tray manager:', error);
            throw error;
        }
    }

    createTray() {
        try {
            // Исправленный путь к иконке
            const iconPath = this.getIconPath();

            this.tray = new Tray(iconPath);
            this.tray.setToolTip('Translator');

            this.updateContextMenu();
            this.setupTrayClickHandler();

            this.logger.info('✓ Tray created successfully');

        } catch (error) {
            this.logger.error('✗ Failed to create tray:', error);
            throw error;
        }
    }

    getIconPath() {
        const basePath = path.join(__dirname, '..', '..', 'public');

        // Проверяем наличие разных форматов иконок
        const possiblePaths = [
            path.join(basePath, 'translate-icon2.png'),
            path.join(basePath, 'translate-icon.png'),
            path.join(basePath, 'icon.ico'),
            path.join(basePath, 'icon.png')
        ];

        // Возвращаем первую найденную иконку
        for (const iconPath of possiblePaths) {
            try {
                require('fs').accessSync(iconPath);
                this.logger.info('Using icon:', iconPath);
                return iconPath;
            } catch (e) {
                continue;
            }
        }

        this.logger.warn('No custom icon found, using default');
        // Если нет иконки, используем пустую строку (система создаст пустую иконку)
        return '';
    }

    updateContextMenu() {
        if (!this.tray) return;

        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Показать переводчик',
                click: () => {
                    if (this.windowManager) {
                        this.windowManager.showWindow();
                    }
                }
            },
            { type: 'separator' },
            {
                label: 'Выход',
                click: () => {
                    app.quit();
                }
            }
        ]);

        this.tray.setContextMenu(contextMenu);
    }

    setupTrayClickHandler() {
        if (!this.tray) return;

        this.tray.on('click', () => {
            if (this.windowManager) {
                this.windowManager.showWindow();
            }
        });
    }

    destroy() {
        if (this.tray) {
            this.tray.destroy();
            this.tray = null;
        }
    }
}

module.exports = TrayManager;