const { app, ipcMain } = require('electron');
const AppManager = require('./core/AppManager');
const Logger = require('./utils/Logger');

const logger = new Logger('Main');
let appManager = null;

// Регистрация IPC обработчиков для API перевода
ipcMain.handle('api-translate', async (event, { text, from, to }) => {
  if (appManager && appManager.translationService) {
    return await appManager.translationService.translate(text, from, to);
  }
  return { error: 'Translation service not available' };
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