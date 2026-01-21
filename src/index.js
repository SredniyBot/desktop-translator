const { app, ipcMain } = require('electron');
const AppManager = require('./core/AppManager');
const Logger = require('./utils/Logger');
const fs = require('fs').promises;
const path = require('path');

const logger = new Logger('Main');
let appManager = null;

// Путь к файлу сохранения темы
const THEME_FILE = path.join(app.getPath('userData'), 'theme.json');

// Регистрация IPC обработчиков для API перевода
ipcMain.handle('api-translate', async (event, { text, from, to }) => {
  if (appManager && appManager.translationService) {
    return await appManager.translationService.translate(text, from, to);
  }
  return { error: 'Translation service not available' };
});

// Сохранение темы
ipcMain.handle('save-theme', async (event, theme) => {
  try {
    const themeData = JSON.stringify({ theme });
    await fs.writeFile(THEME_FILE, themeData, 'utf8');
    logger.info(`Theme saved: ${theme}`);
    return { success: true };
  } catch (error) {
    logger.error('Failed to save theme:', error);
    return { error: error.message };
  }
});

// Загрузка темы
ipcMain.handle('load-theme', async () => {
  try {
    const data = await fs.readFile(THEME_FILE, 'utf8');
    const themeData = JSON.parse(data);
    logger.info(`Theme loaded: ${themeData.theme}`);
    return themeData.theme || 'light';
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.info('No saved theme found, using default');
      return 'light';
    }
    logger.error('Failed to load theme:', error);
    return 'light';
  }
});

app.whenReady().then(() => {
  try {
    appManager = new AppManager();
    appManager.initialize();
    logger.info('Application initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize application:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (appManager && appManager.windowManager) {
    appManager.windowManager.showWindow();
  }
});

app.on('will-quit', () => {
  if (appManager) {
    appManager.cleanup();
  }
});