const { BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const Logger = require('../utils/Logger');
const Platform = require('../utils/Platform');

class WindowManager {
    constructor() {
        this.logger = new Logger('WindowManager');
        this.mainWindow = null;
        this.isPinned = false;
        this.isActivating = false;
        this.ignoreBlurUntil = 0;
        this.isHotkeyCall = false; // Флаг для отслеживания вызова из горячих клавиш
    }

    async initialize() {
        try {
            this.createMainWindow();
            this.setupIpcHandlers();
            this.setupWindowEvents();
            this.logger.info('Window manager initialized');
        } catch (error) {
            this.logger.error('Failed to initialize window manager:', error);
            throw error;
        }
    }

    createMainWindow() {
        const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
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
                preload: path.join(__dirname, '..', 'preload.js'),
                contextIsolation: true,
                nodeIntegration: false,
                backgroundThrottling: false,
                enableRemoteModule: false,
                spellcheck: false
            }
        });

        const indexPath = path.join(__dirname, '..', '..', 'public', 'index.html');
        this.logger.info('Loading HTML from:', indexPath);

        try {
            this.mainWindow.loadFile(indexPath);
        } catch (error) {
            this.logger.error('Failed to load index.html:', error);
            const altPath = path.join(process.cwd(), 'public', 'index.html');
            this.logger.info('Trying alternative path:', altPath);
            this.mainWindow.loadFile(altPath);
        }
    }

    setupWindowEvents() {
        if (!this.mainWindow) return;

        // Обработчик потери фокуса
        this.mainWindow.on('blur', () => {
            this.logger.debug('Window blur event', {
                pinned: this.isPinned,
                ignoreUntil: this.ignoreBlurUntil,
                now: Date.now(),
                isHotkeyCall: this.isHotkeyCall
            });

            // Отправляем событие в рендерер
            this.mainWindow?.webContents.send('window-blur');

            // Если это вызов из горячих клавиш - игнорируем первый blur
            if (this.isHotkeyCall) {
                this.logger.debug('Ignoring blur from hotkey call');
                this.isHotkeyCall = false;
                return;
            }

            // Если окно закреплено - не скрываем
            if (this.isPinned) {
                this.logger.debug('Window pinned, not hiding');
                return;
            }

            // Если недавно активировали окно - игнорируем blur
            if (Date.now() < this.ignoreBlurUntil) {
                this.logger.debug('Window recently activated, ignoring blur');
                return;
            }

            // Задержка перед скрытием (для стабильности)
            setTimeout(() => {
                if (this.mainWindow &&
                    this.mainWindow.isVisible() &&
                    !this.mainWindow.isFocused() &&
                    !this.isPinned) {
                    this.logger.debug('Hiding window after blur');
                    this.hideWindow();
                }
            }, 100);
        });

        this.mainWindow.on('focus', () => {
            this.logger.debug('Window focus event');
            this.mainWindow?.webContents.send('window-focus');
            this.isActivating = false;
            this.isHotkeyCall = false; // Сбрасываем флаг горячих клавиш
        });

        this.mainWindow.on('close', (event) => {
            if (!this.isPinned) {
                event.preventDefault();
                this.hideWindow();
            }
        });

        this.mainWindow.on('hide', () => {
            this.logger.debug('Window hidden');
            this.mainWindow?.webContents.send('window-hidden');
        });

        this.mainWindow.on('show', () => {
            this.logger.debug('Window shown');
        });
    }

    setupIpcHandlers() {
        ipcMain.on('toggle-pin', () => this.togglePin());
        ipcMain.on('hide-window', () => this.hideWindow());
        ipcMain.on('window-drag', (event, delta) => this.moveWindow(delta));
    }

    /**
     * Показ окна
     */
    showWindow(textToInsert = '', fromHotkey = false) {
        if (!this.mainWindow) {
            this.logger.warn('Main window is not initialized');
            return;
        }

        // Устанавливаем флаг для горячих клавиш
        this.isHotkeyCall = fromHotkey;

        this.logger.debug('Showing window', {
            pinned: this.isPinned,
            visible: this.mainWindow.isVisible(),
            fromHotkey: fromHotkey,
            textLength: textToInsert?.length || 0
        });

        // Если окно уже видимо и закреплено
        if (this.mainWindow.isVisible() && this.isPinned) {
            this.logger.debug('Window already visible and pinned');

            // Фокусируем окно
            this.focusWindow(fromHotkey);

            // Отправляем текст если есть, иначе фокус на поле ввода
            setTimeout(() => {
                if (textToInsert && textToInsert.trim()) {
                    this.logger.debug('Sending text to already pinned window');
                    this.mainWindow?.webContents.send('translate-text', textToInsert.trim());
                } else {
                    this.logger.debug('Focusing input in already pinned window');
                    this.mainWindow?.webContents.send('focus-input');
                }
            }, 50);
            return;
        }

        // Если окно уже видимо но не закреплено
        if (this.mainWindow.isVisible() && !this.isPinned) {
            this.logger.debug('Window visible but not pinned');

            this.isActivating = true;
            this.ignoreBlurUntil = Date.now() + 300;

            this.focusWindow(fromHotkey);

            setTimeout(() => {
                if (textToInsert && textToInsert.trim()) {
                    this.mainWindow?.webContents.send('translate-text', textToInsert.trim());
                } else {
                    this.mainWindow?.webContents.send('focus-input');
                }
            }, 50);
            return;
        }

        // Если окно скрыто
        this.logger.debug('Window hidden, showing it');

        // Сбрасываем alwaysOnTop при открытии (если не закреплено)
        if (!this.isPinned) {
            this.mainWindow.setAlwaysOnTop(false);
        }

        // Восстанавливаем если свернуто
        if (this.mainWindow.isMinimized()) {
            this.mainWindow.restore();
        }

        this.isActivating = true;
        this.ignoreBlurUntil = Date.now() + 500;

        this.mainWindow.show();
        this.focusWindow(fromHotkey);

        // Отправляем состояние пина
        setTimeout(() => {
            this.mainWindow?.webContents.send('pin-state-changed', this.isPinned);
        }, 10);

        // Отправляем текст или фокус
        setTimeout(() => {
            if (textToInsert && textToInsert.trim()) {
                this.logger.debug('Sending text to newly shown window');
                this.mainWindow?.webContents.send('translate-text', textToInsert.trim());
            } else {
                this.logger.debug('Focusing input in newly shown window');
                this.mainWindow?.webContents.send('focus-input');
            }
        }, 100);
    }

    /**
     * Фокусировка окна
     */
    focusWindow(fromHotkey = false) {
        if (!this.mainWindow) return;

        try {
            // Фокусируем окно
            this.mainWindow.focus();

            // Особые действия для горячих клавиш
            if (fromHotkey) {
                // Устанавливаем окно поверх всех для гарантированного фокуса
                this.mainWindow.setAlwaysOnTop(true);
                this.mainWindow.moveTop();

                // Платформозависимые хаки для лучшего фокуса
                if (Platform.isWindows()) {
                    setTimeout(() => {
                        if (this.mainWindow) {
                            // Дополнительная гарантия фокуса на Windows
                            this.mainWindow.minimize();
                            this.mainWindow.restore();
                            this.mainWindow.focus();
                        }
                    }, 10);
                } else if (Platform.isMac()) {
                    const { app } = require('electron');
                    app.focus({ steal: true });
                }

                // Возвращаем нормальный режим alwaysOnTop через короткое время
                setTimeout(() => {
                    if (this.mainWindow) {
                        this.mainWindow.setAlwaysOnTop(this.isPinned);
                    }
                }, 300);
            }

            this.logger.debug('Window focused', { fromHotkey: fromHotkey });
        } catch (error) {
            this.logger.error('Failed to focus window:', error);
        }
    }

    /**
     * Скрытие окна
     */
    hideWindow() {
        if (this.mainWindow && this.mainWindow.isVisible()) {
            this.logger.debug('Hiding window');

            // Сбрасываем alwaysOnTop при скрытии (если закреплено)
            if (this.isPinned) {
                this.isPinned = false;
                this.mainWindow.setAlwaysOnTop(false);
                // Отправляем обновленное состояние в рендерер
                this.mainWindow?.webContents.send('pin-state-changed', false);
            }

            this.mainWindow.hide();
        }
    }

    moveWindow(delta) {
        if (!this.mainWindow) return;

        const [x, y] = this.mainWindow.getPosition();
        this.mainWindow.setPosition(x + delta.x, y + delta.y);
    }

    /**
     * Переключение режима закрепления
     */
    togglePin() {
        this.isPinned = !this.isPinned;

        if (!this.mainWindow) return;

        // Применяем изменения к окну
        this.mainWindow.setAlwaysOnTop(this.isPinned);

        // Если закрепляем - гарантируем, что окно видимо
        if (this.isPinned && !this.mainWindow.isVisible()) {
            this.mainWindow.show();
            this.focusWindow();
        }

        // Отправляем новое состояние в рендерер
        this.mainWindow?.webContents.send('pin-state-changed', this.isPinned);

        this.logger.info(`Pin toggled: ${this.isPinned}`);

        return this.isPinned;
    }

    getMainWindow() {
        return this.mainWindow;
    }
}

module.exports = WindowManager;