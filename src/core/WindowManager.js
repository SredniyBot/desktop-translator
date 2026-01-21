const { BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const Logger = require('../utils/Logger');
const Platform = require('../utils/Platform');

class WindowManager {
    constructor() {
        this.logger = new Logger('WindowManager');
        this.mainWindow = null;
        this.isPinned = false;
    }

    async initialize() {
        try {
            this.createMainWindow();
            this.setupIpcHandlers();
            this.logger.info('Window manager initialized');
        } catch (error) {
            this.logger.error('Failed to initialize window manager:', error);
            throw error;
        }
    }

    createMainWindow() {
        // Получаем размеры экрана
        const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

        // Рассчитываем позицию по центру экрана
        const x = Math.floor((screenWidth - 500) / 2);
        const y = Math.floor((screenHeight - 700) / 2);

        this.mainWindow = new BrowserWindow({
            width: 500,
            height: 700,
            x,
            y,
            minWidth: 400,
            minHeight: 500,
            maxWidth: 1000,
            maxHeight: 800,
            frame: false,
            show: false,
            alwaysOnTop: false,
            backgroundColor: '#ffffff',
            webPreferences: {
                // Критически важно: исправленный путь к preload.js
                preload: path.join(__dirname, '..', 'preload.js'),
                contextIsolation: true,
                nodeIntegration: false,
                backgroundThrottling: false,
                enableRemoteModule: false,
                spellcheck: false
            }
        });

        // Критически важно: исправленный путь к index.html
        const indexPath = path.join(__dirname, '..', '..', 'public', 'index.html');
        this.logger.info('Loading HTML from:', indexPath);

        try {
            this.mainWindow.loadFile(indexPath);
        } catch (error) {
            this.logger.error('Failed to load index.html:', error);
            // Альтернативный путь для отладки
            const altPath = path.join(process.cwd(), 'public', 'index.html');
            this.logger.info('Trying alternative path:', altPath);
            this.mainWindow.loadFile(altPath);
        }

        // Открываем DevTools для отладки (можно убрать в production)
        // this.mainWindow.webContents.openDevTools();

        this.setupWindowEvents();
    }

    setupWindowEvents() {
        if (!this.mainWindow) return;

        this.mainWindow.on('blur', () => {
            if (!this.isPinned && this.mainWindow.isVisible()) {
                this.hideWindow();
            }
            this.mainWindow?.webContents.send('window-blur');
        });

        this.mainWindow.on('focus', () => {
            this.mainWindow?.webContents.send('window-focus');
        });

        this.mainWindow.on('close', (event) => {
            if (!this.isPinned) {
                event.preventDefault();
                this.hideWindow();
            }
        });

        this.mainWindow.on('hide', () => {
            this.mainWindow?.webContents.send('window-hidden');
        });
    }

    setupIpcHandlers() {
        ipcMain.on('toggle-pin', () => this.togglePin());
        ipcMain.on('hide-window', () => this.hideWindow());
        ipcMain.on('window-drag', (event, delta) => this.moveWindow(delta));
    }

    /**
     * Простой и надежный метод показа окна
     * Ключевое исправление: сначала показываем, потом фокусируем
     */
    showWindow(textToInsert = '', fromHotkey = false) {
        if (!this.mainWindow) {
            this.logger.warn('Main window is not initialized');
            return;
        }

        // Восстанавливаем если свернуто
        if (this.mainWindow.isMinimized()) {
            this.mainWindow.restore();
        }

        // Показываем окно
        this.mainWindow.show();

        // Ключевое исправление для фокуса:
        // Сначала показываем, потом активируем окно несколькими способами
        this.activateWindow(fromHotkey);

        // Отправляем текст в рендерер
        setTimeout(() => {
            if (textToInsert && textToInsert.trim()) {
                this.logger.info('Sending text to renderer:', textToInsert.substring(0, 50));
                this.mainWindow?.webContents.send('translate-text', textToInsert.trim());
            } else {
                this.mainWindow?.webContents.send('focus-input');
            }
        }, 100);
    }

    /**
     * Активация окна - ключевой метод для решения проблемы фокуса
     */
    activateWindow(fromHotkey = false) {
        if (!this.mainWindow) return;

        try {
            // 1. Базовый focus()
            this.mainWindow.focus();

            // 2. Если открыто через горячие клавиши - принудительно активируем
            if (fromHotkey) {
                // Поднимаем окно поверх всех
                this.mainWindow.setAlwaysOnTop(true);
                this.mainWindow.moveTop();

                // На Windows нужны дополнительные меры
                if (Platform.isWindows()) {
                    // Минимизация и восстановление часто помогает с фокусом
                    setTimeout(() => {
                        this.mainWindow.minimize();
                        this.mainWindow.restore();
                        this.mainWindow.focus();
                    }, 10);
                }

                // На macOS используем активацию приложения
                if (Platform.isMac()) {
                    const { app } = require('electron');
                    app.focus({ steal: true });
                }

                // Через 500мс возвращаем нормальный режим alwaysOnTop
                setTimeout(() => {
                    this.mainWindow.setAlwaysOnTop(this.isPinned);
                }, 500);
            }

            // 3. Дополнительная гарантия фокуса через короткое время
            setTimeout(() => {
                if (this.mainWindow && !this.mainWindow.isFocused()) {
                    this.mainWindow.focus();
                }
            }, 50);

            this.logger.debug('Window activated');
        } catch (error) {
            this.logger.error('Failed to activate window:', error);
        }
    }

    hideWindow() {
        if (this.mainWindow && this.mainWindow.isVisible()) {
            this.mainWindow.hide();
        }
    }

    moveWindow(delta) {
        if (!this.mainWindow) return;

        const [x, y] = this.mainWindow.getPosition();
        this.mainWindow.setPosition(x + delta.x, y + delta.y);
    }

    togglePin() {
        this.isPinned = !this.isPinned;

        if (!this.mainWindow) return;

        this.mainWindow.setAlwaysOnTop(this.isPinned);

        if (this.isPinned) {
            this.mainWindow.show();
            this.activateWindow();
        }

        this.logger.info(`Pin toggled: ${this.isPinned}`);
        this.mainWindow?.webContents.send('pin-state-changed', this.isPinned);

        return this.isPinned;
    }

    getMainWindow() {
        return this.mainWindow;
    }
}

module.exports = WindowManager;