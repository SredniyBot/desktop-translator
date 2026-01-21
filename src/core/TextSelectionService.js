const { clipboard } = require('electron');
const robot = require('robotjs');
const Logger = require('../utils/Logger');
const Platform = require('../utils/Platform');

/**
 * Сервис получения выделенного текста
 * Отвечает за получение текста, выделенного в других приложениях
 */
class TextSelectionService {
    constructor() {
        this.logger = new Logger('TextSelectionService');
        this.clipboardBackup = null;
        this.restoreTimeout = null;
        this.isGettingText = false;
    }

    /**
     * Получает выделенный текст из активного приложения
     * @returns {Promise<string|null>} Выделенный текст или null
     */
    async getSelectedText() {
        if (this.isGettingText) {
            this.logger.warn('Already getting text, skipping');
            return null;
        }

        this.isGettingText = true;

        try {
            // Создаем резервную копию буфера обмена
            this.clipboardBackup = clipboard.readText();
            clipboard.clear();

            // Имитируем нажатие Ctrl+C / Cmd+C
            await this.simulateCopyCommand();

            // Ждем обновления буфера обмена
            await this.delay(150);

            // Читаем выделенный текст
            const selectedText = clipboard.readText().trim();

            // Восстанавливаем оригинальный буфер обмена
            this.scheduleClipboardRestore();

            this.logger.debug('Selected text retrieved:', selectedText?.substring(0, 50));
            return selectedText || null;

        } catch (error) {
            this.logger.error('Failed to get selected text:', error);
            this.restoreClipboard();
            return null;
        } finally {
            this.isGettingText = false;
        }
    }

    /**
     * Имитирует команду копирования в зависимости от ОС
     */
    async simulateCopyCommand() {
        try {
            const modifier = Platform.isMac() ? 'command' : 'control';
            robot.keyTap('c', modifier);

            // Небольшая задержка для обработки системой
            await this.delay(50);

        } catch (error) {
            this.logger.error('Failed to simulate copy command:', error);
            throw error;
        }
    }

    /**
     * Планирует восстановление буфера обмена
     */
    scheduleClipboardRestore() {
        if (this.restoreTimeout) {
            clearTimeout(this.restoreTimeout);
        }

        this.restoreTimeout = setTimeout(() => {
            this.restoreClipboard();
        }, 1000);
    }

    /**
     * Восстанавливает оригинальное содержимое буфера обмена
     */
    restoreClipboard() {
        try {
            if (this.clipboardBackup !== null) {
                clipboard.writeText(this.clipboardBackup);
                this.clipboardBackup = null;
            }

            if (this.restoreTimeout) {
                clearTimeout(this.restoreTimeout);
                this.restoreTimeout = null;
            }
        } catch (error) {
            this.logger.error('Failed to restore clipboard:', error);
        }
    }

    /**
     * Задержка в миллисекундах
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Выполняет диагностику системы
     */
    diagnoseSystem() {
        this.logger.info('=== System Diagnostics ===');
        this.logger.info('Platform:', process.platform);
        this.logger.info('Node version:', process.version);
        this.logger.info('Electron version:', process.versions.electron);
        this.logger.info('Clipboard available:', typeof clipboard !== 'undefined');
        this.logger.info('RobotJS available:', typeof robot !== 'undefined');
        this.logger.info('==========================');
    }

    /**
     * Проверяет доступность сервиса
     */
    async testService() {
        try {
            const testText = 'Test selection';
            clipboard.writeText(testText);

            const readText = clipboard.readText();
            const clipboardWorking = readText === testText;

            clipboard.clear();

            return {
                clipboard: clipboardWorking,
                robotjs: typeof robot !== 'undefined',
                platform: process.platform
            };
        } catch (error) {
            this.logger.error('Service test failed:', error);
            return { error: error.message };
        }
    }
}

module.exports = TextSelectionService;