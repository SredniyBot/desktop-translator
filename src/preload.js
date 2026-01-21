const { contextBridge, ipcRenderer } = require('electron');

// Простой и надежный API для рендерера
contextBridge.exposeInMainWorld('electronAPI', {
  // Получение текста для перевода
  onTranslateText: (callback) => {
    ipcRenderer.on('translate-text', (event, text) => callback(text));
  },

  onFocusInput: (callback) => {
    ipcRenderer.on('focus-input', callback);
  },

  // API для перевода текста
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

  // Состояние пина
  onPinStateChanged: (callback) => {
    ipcRenderer.on('pin-state-changed', (event, isPinned) => {
      callback(isPinned);
    });
  },

  // Хранилище для темы
  saveTheme: (theme) => ipcRenderer.invoke('save-theme', theme),
  loadTheme: () => ipcRenderer.invoke('load-theme')
});