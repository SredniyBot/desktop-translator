const { contextBridge, ipcRenderer } = require('electron');

// Современный API для рендерера с поддержкой настроек
contextBridge.exposeInMainWorld('electronAPI', {
  // Основные функции
  onTranslateText: (callback) => {
    ipcRenderer.on('translate-text', (event, text) => callback(text));
  },
  onFocusInput: (callback) => {
    ipcRenderer.on('focus-input', callback);
  },

  // Перевод
  translateAPI: (text, from, to) => {
    return ipcRenderer.invoke('api-translate', { text, from, to });
  },

  // Управление окном
  togglePin: () => ipcRenderer.send('toggle-pin'),
  hideWindow: () => ipcRenderer.send('hide-window'),
  dragWindow: (position) => ipcRenderer.send('window-drag', position),

  // События окна
  onWindowBlur: (callback) => {
    ipcRenderer.on('window-blur', callback);
  },
  onWindowFocus: (callback) => {
    ipcRenderer.on('window-focus', callback);
  },
  onWindowHidden: (callback) => {
    ipcRenderer.on('window-hidden', callback);
  },
  onWindowShown: (callback) => {
    ipcRenderer.on('window-shown', callback);
  },

  // Пин
  onPinStateChanged: (callback) => {
    ipcRenderer.on('pin-state-changed', (event, isPinned) => {
      callback(isPinned);
    });
  },

  // Провайдер
  onProviderChanged: (callback) => {
    ipcRenderer.on('provider-changed', (event, providerSettings) => {
      callback(providerSettings);
    });
  },

  // Настройки - новая архитектура
  getSettingsStructure: () => ipcRenderer.invoke('get-settings-structure'),
  getAllSettings: () => ipcRenderer.invoke('get-all-settings'),
  getSetting: (path) => ipcRenderer.invoke('get-setting', path),
  updateSetting: (path, value) => ipcRenderer.invoke('update-setting', { path, value }),
  resetSettings: () => ipcRenderer.invoke('reset-settings'),
  testProviderConnection: (provider, apiKey, config) =>
      ipcRenderer.invoke('test-provider-connection', { provider, apiKey, config }),

  // Языки
  getSupportedLanguages: () => ipcRenderer.invoke('get-supported-languages'),

  // История
  getTranslationHistory: () => ipcRenderer.invoke('get-translation-history'),
  clearTranslationHistory: () => ipcRenderer.invoke('clear-translation-history'),

  // Информация о провайдере
  getCurrentProviderInfo: () => ipcRenderer.invoke('get-current-provider-info'),

  // Тема (для обратной совместимости)
  onThemeChanged: (callback) => {
    ipcRenderer.on('theme-changed', (event, theme) => callback(theme));
  },
  onThemeColorChanged: (callback) => {
    ipcRenderer.on('theme-color-changed', (event, color) => callback(color));
  }
});