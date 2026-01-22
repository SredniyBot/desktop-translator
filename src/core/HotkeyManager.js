const { clipboard } = require('electron');
const { uIOhook, UiohookKey } = require('uiohook-napi');
const Logger = require('../utils/Logger');

/**
 * Менеджер глобальных горячих клавиш
 * Отвечает за регистрацию и обработку системных горячих клавиш
 */
class HotkeyManager {
    constructor({ windowManager, textSelectionService, settingsManager } = {}) {
        this.logger = new Logger('HotkeyManager');
        this.windowManager = windowManager;
        this.textSelectionService = textSelectionService;
        this.settingsManager = settingsManager;

        this.ctrlCPressCount = 0;
        this.ctrlCResetTimer = null;
        this.DOUBLE_TAP_TIMEOUT_MS = 500;

        this.isInitialized = false;
        this.activeHotkeys = new Map();
    }

    /**
     * Инициализирует менеджер горячих клавиш
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }

        try {
            // Загружаем горячие клавиши из настроек
            await this.loadHotkeysFromSettings();

            // Регистрируем глобальные горячие клавиши
            this.registerGlobalHotkeys();

            // Слушаем изменения настроек
            if (this.settingsManager) {
                this.settingsManager.addChangeListener(this.onSettingsChanged.bind(this));
            }

            this.isInitialized = true;
            this.logger.info('Hotkey manager initialized');
        } catch (error) {
            this.logger.error('Failed to initialize hotkey manager:', error);
            throw error;
        }
    }

    /**
     * Загружает горячие клавиши из настроек
     */
    async loadHotkeysFromSettings() {
        if (!this.settingsManager) return;

        try {
            const hotkeys = this.settingsManager.getSetting('app.hotkeys', []);
            this.activeHotkeys.clear();

            hotkeys.forEach(hotkey => {
                this.activeHotkeys.set(hotkey.id, hotkey);
            });

            this.logger.info(`Loaded ${hotkeys.length} hotkeys from settings`);
        } catch (error) {
            this.logger.error('Failed to load hotkeys from settings:', error);
        }
    }

    /**
     * Обрабатывает изменения настроек
     */
    onSettingsChanged(settings) {
        if (settings && settings.app && settings.app.hotkeys) {
            this.loadHotkeysFromSettings();
        }
    }

    /**
     * Регистрирует глобальные горячие клавиши
     */
    registerGlobalHotkeys() {
        this.logger.info('Registering global hotkeys...');

        // Удаляем старые обработчики
        uIOhook.removeAllListeners('keydown');

        // Регистрируем новые обработчики
        uIOhook.on('keydown', (event) => {
            this.handleKeyDown(event);
        });

        // Запускаем отслеживание
        try {
            uIOhook.start();
            this.logger.info('✓ Global hotkeys registered successfully');
        } catch (error) {
            this.logger.error('✗ Failed to register global hotkeys:', error);
            throw error;
        }
    }

    /**
     * Обрабатывает нажатие клавиш
     */
    handleKeyDown(event) {
        // Проверяем зарегистрированные горячие клавиши
        for (const [id, hotkey] of this.activeHotkeys) {
            if (this.checkHotkeyMatch(event, hotkey.key)) {
                this.handleRegisteredHotkey(id, hotkey);
                return;
            }
        }

        // Стандартные горячие клавиши (для обратной совместимости)
        if (this.isCtrlC(event)) {
            this.handleCtrlC();
            return;
        }

        if (this.isCtrlAltQ(event)) {
            this.handleCtrlAltQ();
            return;
        }

        // Сброс счетчика Ctrl+C при нажатии других клавиш
        this.resetCtrlCCounterIfNeeded(event);
    }

    /**
     * Проверяет соответствие события горячей клавише
     */
    checkHotkeyMatch(event, hotkeyString) {
        // Пока заглушка - в реальности нужно парсить строку горячих клавиш
        // и сравнивать с событием
        return false;
    }

    /**
     * Обрабатывает зарегистрированную горячую клавишу
     */
    handleRegisteredHotkey(id, hotkey) {
        this.logger.info(`Hotkey triggered: ${hotkey.name} (${hotkey.key})`);

        // Здесь будет логика для разных горячих клавиш
        switch (id) {
            case 'translate_selected':
                this.handleCtrlAltQ();
                break;
            case 'open_translator':
                this.handleDoubleCtrlC();
                break;
            default:
                this.logger.warn(`No handler for hotkey: ${id}`);
        }
    }

    /**
     * Проверяет, является ли событие нажатием Ctrl+C
     */
    isCtrlC(event) {
        return event.ctrlKey &&
            !event.altKey &&
            !event.shiftKey &&
            event.keycode === UiohookKey.C;
    }

    /**
     * Проверяет, является ли событие нажатием Ctrl+Alt+Q
     */
    isCtrlAltQ(event) {
        return event.ctrlKey &&
            event.altKey &&
            !event.shiftKey &&
            event.keycode === UiohookKey.Q;
    }

    /**
     * Обрабатывает нажатие Ctrl+C
     */
    handleCtrlC() {
        this.ctrlCPressCount++;

        // Сбрасываем таймер, если он был установлен
        if (this.ctrlCResetTimer) {
            clearTimeout(this.ctrlCResetTimer);
        }

        this.logger.debug(`Ctrl+C pressed (count: ${this.ctrlCPressCount})`);

        // Двойное нажатие
        if (this.ctrlCPressCount === 2) {
            this.ctrlCPressCount = 0;
            clearTimeout(this.ctrlCResetTimer);
            this.handleDoubleCtrlC();
        }
        // Одиночное нажатие (запускаем таймер сброса)
        else if (this.ctrlCPressCount === 1) {
            this.ctrlCResetTimer = setTimeout(() => {
                this.ctrlCPressCount = 0;
                this.logger.debug('Ctrl+C timeout, reset counter');
            }, this.DOUBLE_TAP_TIMEOUT_MS);
        }
    }

    /**
     * Обрабатывает двойное нажатие Ctrl+C
     */
    async handleDoubleCtrlC() {
        try {
            const clipboardText = clipboard.readText();
            this.logger.info('✓ Ctrl+C+C detected! Opening translator...');

            if (this.windowManager) {
                this.windowManager.showWindow(clipboardText, true);
            }
        } catch (error) {
            this.logger.error('Failed to handle double Ctrl+C:', error);

            // Все равно открываем окно
            if (this.windowManager) {
                this.windowManager.showWindow('', true);
            }
        }
    }

    /**
     * Обрабатывает нажатие Ctrl+Alt+Q
     */
    async handleCtrlAltQ() {
        try {
            this.logger.info('✓ Ctrl+Alt+Q detected! Getting selected text...');

            if (!this.textSelectionService || !this.windowManager) {
                this.logger.warn('Required services not available');
                return;
            }

            const selectedText = await this.textSelectionService.getSelectedText();
            this.logger.debug('Selected text:', selectedText?.substring(0, 50));

            this.windowManager.showWindow(selectedText, true);
        } catch (error) {
            this.logger.error('Failed to handle Ctrl+Alt+Q:', error);

            // Все равно открываем окно
            if (this.windowManager) {
                this.windowManager.showWindow('', true);
            }
        }
    }

    /**
     * Сбрасывает счетчик Ctrl+C при нажатии других клавиш
     */
    resetCtrlCCounterIfNeeded(event) {
        if (this.ctrlCPressCount > 0 && event.keycode !== UiohookKey.C) {
            this.ctrlCPressCount = 0;
            if (this.ctrlCResetTimer) {
                clearTimeout(this.ctrlCResetTimer);
            }
        }
    }

    /**
     * Возвращает список активных горячих клавиш
     */
    getActiveHotkeys() {
        return Array.from(this.activeHotkeys.values());
    }

    /**
     * Очищает ресурсы менеджера
     */
    cleanup() {
        try {
            if (this.ctrlCResetTimer) {
                clearTimeout(this.ctrlCResetTimer);
            }

            if (this.settingsManager) {
                // Удаляем слушателя изменений настроек
                // (нужно сохранить ссылку на метод для удаления)
            }

            uIOhook.stop();
            uIOhook.removeAllListeners();

            this.logger.info('Hotkey manager cleaned up');
        } catch (error) {
            this.logger.error('Error cleaning up hotkey manager:', error);
        }
    }
}

module.exports = HotkeyManager;