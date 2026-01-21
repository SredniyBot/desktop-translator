/**
 * Утилиты для работы с платформой
 */
class Platform {
    /**
     * Проверяет, является ли платформа Windows
     */
    static isWindows() {
        return process.platform === 'win32';
    }

    /**
     * Проверяет, является ли платформа macOS
     */
    static isMac() {
        return process.platform === 'darwin';
    }

    /**
     * Проверяет, является ли платформа Linux
     */
    static isLinux() {
        return process.platform === 'linux';
    }

    /**
     * Возвращает модификатор для горячих клавиш в зависимости от платформы
     */
    static getModifierKey() {
        return this.isMac() ? 'command' : 'control';
    }

    /**
     * Возвращает альтернативный модификатор (обычно Alt/Option)
     */
    static getAltModifierKey() {
        return 'alt';
    }

    /**
     * Возвращает разделитель путей для платформы
     */
    static getPathSeparator() {
        return this.isWindows() ? '\\' : '/';
    }

    /**
     * Нормализует путь для текущей платформы
     */
    static normalizePath(path) {
        if (this.isWindows()) {
            return path.replace(/\//g, '\\');
        }
        return path.replace(/\\/g, '/');
    }

    /**
     * Возвращает путь к домашней директории пользователя
     */
    static getHomeDirectory() {
        return require('os').homedir();
    }

    /**
     * Возвращает путь для хранения данных приложения
     */
    static getAppDataPath(appName) {
        const os = require('os');
        const path = require('path');

        if (this.isWindows()) {
            return path.join(process.env.APPDATA, appName);
        } else if (this.isMac()) {
            return path.join(os.homedir(), 'Library', 'Application Support', appName);
        } else {
            return path.join(os.homedir(), '.config', appName);
        }
    }

    /**
     * Проверяет, поддерживается ли прозрачность окон
     */
    static supportsWindowTransparency() {
        return !this.isLinux(); // Linux может иметь проблемы с прозрачностью
    }

    /**
     * Возвращает информацию о системе
     */
    static getSystemInfo() {
        const os = require('os');

        return {
            platform: process.platform,
            arch: process.arch,
            release: os.release(),
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            cpus: os.cpus().length,
            hostname: os.homedir()
        };
    }
}

module.exports = Platform;