if (require('electron-squirrel-startup')) {
  process.exit(0);
}

const {
  app,
  BrowserWindow,
  clipboard,
  Tray,
  Menu,
  ipcMain,
  screen
} = require('electron');

const path = require('path');
const axios = require('axios');
const { uIOhook, UiohookKey } = require('uiohook-napi');

const { getSelectedText, diagnoseSystem } = require('./textSelection');

// === GLOBAL STATE ===

let mainWindow = null;
let tray = null;
let isPinned = false;

// Состояние двойного Ctrl+C
let ctrlCPressCount = 0;
let ctrlCResetTimer = null;
const DOUBLE_TAP_TIMEOUT_MS = 500;

// === WINDOW CREATION ===

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: 500,
    height: Math.min(700, height),
    minWidth: 400,
    minHeight: 500,
    maxWidth: 1000,
    maxHeight: 800,
    frame: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'public', 'index.html'));

  mainWindow.on('blur', () => {
    if (!isPinned && mainWindow) {
      mainWindow.hide();
    }
    mainWindow?.webContents.send('window-blur');
  });

  mainWindow.on('focus', () => {
    mainWindow?.webContents.send('window-focus');
  });

  mainWindow.on('close', (event) => {
    if (!isPinned) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('hide', () => {
    mainWindow?.webContents.send('window-hidden');
  });
}

function showMainWindow(textToInsert) {
  if (!mainWindow) {
    console.warn('mainWindow is null');
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();

  setImmediate(() => {
    if (textToInsert && textToInsert.trim()) {
      mainWindow.webContents.send('translate-text', textToInsert.trim());
    } else {
      mainWindow.webContents.send('focus-input');
    }
  });
}

function handleDoubleCtrlC() {
  const clipboardText = clipboard.readText();
  console.log('✓ Ctrl+C+C detected! Clipboard text:', clipboardText.substring(0, 50));
  showMainWindow(clipboardText);
}

// === GLOBAL HOTKEYS REGISTRATION ===

function registerGlobalHotkeys() {
  console.log('Registering global hotkeys...');

  uIOhook.removeAllListeners('keydown');

  uIOhook.on('keydown', (event) => {
    // Ctrl+C+C
    if (event.ctrlKey && event.keycode === UiohookKey.C) {
      ctrlCPressCount++;

      if (ctrlCResetTimer) {
        clearTimeout(ctrlCResetTimer);
      }

      console.log(`Ctrl+C pressed (count: ${ctrlCPressCount})`);

      if (ctrlCPressCount === 2) {
        ctrlCPressCount = 0;
        clearTimeout(ctrlCResetTimer);
        handleDoubleCtrlC();
      } else if (ctrlCPressCount === 1) {
        ctrlCResetTimer = setTimeout(() => {
          ctrlCPressCount = 0;
          console.log('Ctrl+C timeout, reset counter');
        }, DOUBLE_TAP_TIMEOUT_MS);
      }
      return;
    }

    // Ctrl+Alt+Q (альтернативный способ открыть и перевести выделенный текст)
    if (event.ctrlKey && event.altKey && event.keycode === UiohookKey.Q) {
      console.log('✓ Ctrl+Alt+Q detected!');
      getSelectedText()
          .then((selectedText) => {
            console.log('Selected text:', selectedText?.substring(0, 50));
            showMainWindow(selectedText);
          })
          .catch((error) => {
            console.error('Error getting selected text:', error);
            showMainWindow(null);
          });
      return;
    }

    // Любая другая клавиша сбрасывает счётчик Ctrl+C
    if (ctrlCPressCount > 0 && event.keycode !== UiohookKey.C) {
      ctrlCPressCount = 0;
      if (ctrlCResetTimer) {
        clearTimeout(ctrlCResetTimer);
      }
    }
  });

  try {
    uIOhook.start();
    console.log('✓ uIOhook started successfully');
  } catch (error) {
    console.error('✗ Failed to start uIOhook:', error);
  }
}

// === TRAY ===

function createTray() {
  try {
    tray = new Tray(path.join(__dirname, '..', 'public', 'earth.png'));
    tray.setToolTip('Translator');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show window',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Exit',
        click: () => {
          app.quit();
        }
      }
    ]);

    tray.setContextMenu(contextMenu);
    console.log('✓ Tray created');
  } catch (error) {
    console.error('✗ Failed to create tray:', error);
  }
}

// === APPLICATION LIFECYCLE ===

app.whenReady().then(() => {
  createWindow();
  diagnoseSystem();
  registerGlobalHotkeys();
  createTray();

  app.setLoginItemSettings({ openAtLogin: true });

  console.log('✓ Application initialized');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  try {
    uIOhook.stop();
    console.log('✓ uIOhook stopped');
  } catch (error) {
    console.error('Error stopping uIOhook:', error);
  }
});

// === IPC HANDLERS ===

ipcMain.on('toggle-pin', () => {
  isPinned = !isPinned;

  if (!mainWindow) {
    return;
  }

  mainWindow.setAlwaysOnTop(isPinned);

  if (isPinned) {
    mainWindow.show();
  }

  console.log(`Pin toggled: ${isPinned}`);
});

ipcMain.on('hide-window', () => {
  mainWindow?.hide();
});

ipcMain.on('window-drag', (event, pos) => {
  if (!mainWindow) {
    return;
  }

  const [x, y] = mainWindow.getPosition();
  mainWindow.setPosition(x + pos.x, y + pos.y);
});

ipcMain.handle('api-translate', async (event, { text, from, to }) => {
  try {
    // TODO: подключить реальный API перевода
    // const response = await axios.get('https://api.example.com/translate', {
    //   params: { text, from, to }
    // });
    // return { translatedText: response.data.result };
    console.error('Translation API error:', error);

    return { translatedText: 'TODO: Implement translation API' };
  } catch (error) {
    console.error('Translation API error:', error);
    return { error: error.message || 'Translation error' };
  }
});
