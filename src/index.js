const { app, ipcMain, BrowserWindow } = require('electron');
const AppManager = require('./core/AppManager');
const Logger = require('./utils/Logger');

const logger = new Logger('Main');
let appManager = null;

// Регистрация IPC обработчиков
ipcMain.handle('api-translate', async (event, { text, from, to }) => {
  if (appManager && appManager.translationManager) {
    try {
      const result = await appManager.translationManager.translate(text, from, to);
      return result;
    } catch (error) {
      logger.error('Translation failed:', error);
      return { error: error.message };
    }
  }
  return { error: 'Translation service not available' };
});

// Настройки
ipcMain.handle('get-settings-structure', async () => {
  if (appManager && appManager.settingsManager) {
    return appManager.settingsManager.getSettingsStructure();
  }
  return [];
});

ipcMain.handle('get-all-settings', async () => {
  if (appManager && appManager.settingsStore) {
    return appManager.settingsStore.getAll();
  }
  return null;
});

ipcMain.handle('get-setting', async (event, path) => {
  if (appManager && appManager.settingsStore) {
    return appManager.settingsStore.get(path);
  }
  return null;
});

ipcMain.handle('update-setting', async (event, { path, value }) => {
  if (appManager && appManager.settingsStore) {
    const success = await appManager.settingsStore.set(path, value, false);

    // Отправляем события изменения темы и цвета
    if (path === 'customization.theme') {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        mainWindow.webContents.send('theme-changed', value);
      }
    }

    if (path === 'customization.themeColor') {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        mainWindow.webContents.send('theme-color-changed', value);
      }
    }

    // Отправляем событие смены провайдера
    if (path.startsWith('provider.')) {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        const providerSettings = appManager.settingsStore.getAll().provider;
        mainWindow.webContents.send('provider-changed', providerSettings);
      }
    }

    return success;
  }
  return false;
});

ipcMain.handle('reset-settings', async () => {
  if (appManager && appManager.settingsStore) {
    return await appManager.settingsStore.reset();
  }
  return false;
});

ipcMain.handle('test-provider-connection', async (event, { provider, apiKey, config }) => {
  if (appManager && appManager.settingsManager) {
    return await appManager.settingsManager.testProviderConnection(provider, apiKey, config);
  }
  return { success: false, error: 'Settings manager not available' };
});

ipcMain.handle('get-supported-languages', async () => {
  if (appManager && appManager.translationManager) {
    try {
      const languages = await appManager.translationManager.getSupportedLanguages();
      return languages;
    } catch (error) {
      logger.error('Failed to get supported languages:', error);
      return [];
    }
  }
  return [];
});

ipcMain.handle('get-translation-history', async () => {
  if (appManager && appManager.settingsManager) {
    return await appManager.settingsManager.getTranslationHistory();
  }
  return [];
});

ipcMain.handle('clear-translation-history', async () => {
  if (appManager && appManager.settingsManager) {
    return await appManager.settingsManager.clearTranslationHistory();
  }
  return false;
});

ipcMain.handle('get-current-provider-info', async () => {
  if (appManager && appManager.translationManager) {
    return appManager.translationManager.getCurrentProviderInfo();
  }
  return { name: 'none', initialized: false };
});

// Инициализация приложения
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