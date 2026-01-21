/**
 * Утилита для структурированного логирования
 */
class Logger {
    constructor(moduleName = 'App') {
        this.moduleName = moduleName;
        this.colors = {
            reset: '\x1b[0m',
            red: '\x1b[31m',
            green: '\x1b[32m',
            yellow: '\x1b[33m',
            blue: '\x1b[34m',
            magenta: '\x1b[35m',
            cyan: '\x1b[36m',
            white: '\x1b[37m'
        };
    }

    /**
     * Форматирует сообщение лога
     */
    formatMessage(level, message) {
        const timestamp = new Date().toISOString();
        const color = this.getColorForLevel(level);
        const reset = this.colors.reset;

        return `${color}[${timestamp}] [${level}] [${this.moduleName}]${reset} ${message}`;
    }

    /**
     * Возвращает цвет для уровня логирования
     */
    getColorForLevel(level) {
        switch (level) {
            case 'ERROR': return this.colors.red;
            case 'WARN': return this.colors.yellow;
            case 'INFO': return this.colors.green;
            case 'DEBUG': return this.colors.blue;
            default: return this.colors.white;
        }
    }

    /**
     * Логирует сообщение
     */
    log(level, message, ...args) {
        const formattedMessage = this.formatMessage(level, message);
        console.log(formattedMessage, ...args);
    }

    /**
     * Информационное сообщение
     */
    info(message, ...args) {
        this.log('INFO', message, ...args);
    }

    /**
     * Предупреждение
     */
    warn(message, ...args) {
        this.log('WARN', message, ...args);
    }

    /**
     * Ошибка
     */
    error(message, ...args) {
        this.log('ERROR', message, ...args);
    }

    /**
     * Отладочное сообщение
     */
    debug(message, ...args) {
        // В production можно отключать debug логи
        if (process.env.NODE_ENV !== 'production') {
            this.log('DEBUG', message, ...args);
        }
    }

    /**
     * Создает дочерний логгер с префиксом модуля
     */
    child(moduleName) {
        return new Logger(`${this.moduleName}:${moduleName}`);
    }
}

module.exports = Logger;