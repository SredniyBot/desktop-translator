if (require('electron-squirrel-startup')) app.quit();
const { app, BrowserWindow, globalShortcut, clipboard, Tray, Menu, ipcMain, screen } = require('electron');
const path = require('path');
const axios = require('axios');
const { getSelectedText, diagnoseSystem } = require('./textSelection');

let mainWindow;
let tray;
let isPinned = false;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: 500,
    minWidth: 400,
    minHeight: 500,
    maxWidth: 1000,
    maxHeight: 800,
    frame: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: true,
      backgroundThrottling: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'public', 'index.html'));

  mainWindow.on('blur', () => {
    if (!isPinned) {
      mainWindow.hide();
    }
    mainWindow.webContents.send('window-blur');
  });

  mainWindow.on('focus', () => {
    mainWindow.webContents.send('window-focus');
  });

  mainWindow.on('close', (e) => {
    if (!isPinned) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('hide', () => {
    mainWindow.webContents.send('window-hidden');
  });

  ipcMain.on('window-drag', (event, pos) => {
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition();
      mainWindow.setPosition(x + pos.x, y + pos.y);
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  diagnoseSystem();

  globalShortcut.register('Control+Alt+Q', async () => {
    console.log('Hotkey pressed');
    
    // 1. Сначала получаем текст БЕЗ показа окна
    const selectedText = await getSelectedText();
    
    // 2. Только после получения текста показываем окно
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    mainWindow.focus();
    
    // 3. Даем время на инициализацию интерфейса
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // 4. Передаем текст или фокусируем поле ввода
    if (selectedText && selectedText.trim()) {
      mainWindow.webContents.send('translate-text', selectedText.trim());
    } else {
      mainWindow.webContents.send('focus-input');
    }
  });

  tray = new Tray(path.join(__dirname, '..', 'public', 'earth.png'));
  tray.setToolTip('Translator');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show window', click: () => mainWindow.show() },
    { label: 'Exit', click: () => app.quit() }
  ]));

  app.setLoginItemSettings({ openAtLogin: true });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => globalShortcut.unregisterAll());

ipcMain.on('toggle-pin', () => {
  isPinned = !isPinned;
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(isPinned);
    if (isPinned) mainWindow.show();
  }
});

ipcMain.on('hide-window', () => {
  mainWindow?.hide();
});

ipcMain.handle('api-translate', async (event, { text, from, to }) => {
  try {
    return { translatedText: "TODO" };
  } catch (err) {
    console.error('Translation API error:', err);
    return { error: err.message || 'Translation error' };
  }
});