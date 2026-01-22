const { app, ipcMain, BrowserWindow } = require('electron');
const AppManager = require('./core/AppManager');
const Logger = require('./utils/Logger');

const logger = new Logger('Main');
let appManager = null;

// Регистрация IPC обработчиков
ipcMain.handle('api-translate', async (event, { text, from, to }) => {
  if (appManager && appManager.translationService) {
    return await appManager.translationService.translate(text, from, to);
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

ipcMain.handle('test-provider-connection', async (event, { provider, apiKey }) => {
  if (appManager && appManager.settingsManager) {
    return await appManager.settingsManager.testProviderConnection(provider, apiKey);
  }
  return { success: false, error: 'Settings manager not available' };
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