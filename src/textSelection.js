const { clipboard } = require('electron');
const { spawn, exec } = require('child_process');
const os = require('os');

/**
 * Получение выделенного текста через PowerShell (Windows)
 */
function getSelectedTextWindows() {
  return new Promise((resolve) => {
    console.log('Using Windows PowerShell method...');

    // PowerShell скрипт для безопасного копирования выделенного текста
    const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Сохраняем текущий буфер обмена
$originalClipboard = ""
try {
  $originalClipboard = [System.Windows.Forms.Clipboard]::GetText()
} catch {
  $originalClipboard = ""
}

# Очищаем буфер обмена
[System.Windows.Forms.Clipboard]::Clear()

# Имитируем Ctrl+C через SendKeys
try {
  [System.Windows.Forms.SendKeys]::SendWait("^c")
  Start-Sleep -Milliseconds 500
  
  # Получаем новый контент
  $newClipboard = ""
  try {
    $newClipboard = [System.Windows.Forms.Clipboard]::GetText()
  } catch {
    $newClipboard = ""
  }
  
  # Восстанавливаем оригинальный буфер обмена
  try {
    [System.Windows.Forms.Clipboard]::SetText($originalClipboard)
  } catch {
    # Если не можем восстановить, хотя бы очистим
    [System.Windows.Forms.Clipboard]::Clear()
  }
  
  # Выводим результат только если получили новый текст
  if ($newClipboard -and $newClipboard -ne $originalClipboard) {
    Write-Output $newClipboard
  } else {
    Write-Output ""
  }
} catch {
  # В случае ошибки восстанавливаем буфер обмена
  try {
    [System.Windows.Forms.Clipboard]::SetText($originalClipboard)
  } catch {}
  Write-Output ""
}
`;

    const child = spawn('powershell', [
      '-ExecutionPolicy', 'Bypass',
      '-WindowStyle', 'Hidden',
      '-Command', script
    ], {
      windowsHide: true,
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      const result = output.trim();
      if (code === 0 && result) {
        console.log('PowerShell method successful:', `"${result}"`);
        resolve(result);
      } else {
        console.log('PowerShell method failed, code:', code);
        if (errorOutput) console.log('PowerShell error:', errorOutput);
        resolve(null);
      }
    });

    child.on('error', (err) => {
      console.log('PowerShell spawn error:', err.message);
      resolve(null);
    });

    // Таймаут на случай зависания
    setTimeout(() => {
      if (!child.killed) {
        child.kill();
        console.log('PowerShell method timed out');
        resolve(null);
      }
    }, 3000);
  });
}

/**
 * Получение выделенного текста через xclip (Linux)
 */
function getSelectedTextLinux() {
  return new Promise((resolve) => {
    console.log('Using Linux xclip method...');

    // Сначала проверяем, есть ли xclip
    exec('which xclip', (error) => {
      if (error) {
        console.log('xclip not found, trying xsel...');
        // Пробуем xsel как альтернативу
        exec('which xsel', (xselError) => {
          if (xselError) {
            console.log('Neither xclip nor xsel found');
            resolve(null);
            return;
          }
          
          // Используем xsel
          exec('xsel -p', { timeout: 2000 }, (err, stdout, stderr) => {
            if (err) {
              console.log('xsel error:', err.message);
              resolve(null);
            } else {
              const result = stdout.trim();
              console.log('xsel result:', result ? `"${result}"` : 'empty');
              resolve(result || null);
            }
          });
        });
        return;
      }

      // Используем xclip для получения PRIMARY selection (выделенный текст)
      exec('xclip -selection primary -o', { timeout: 2000 }, (err, stdout, stderr) => {
        if (err) {
          console.log('xclip error:', err.message);
          resolve(null);
        } else {
          const result = stdout.trim();
          console.log('xclip result:', result ? `"${result}"` : 'empty');
          resolve(result || null);
        }
      });
    });
  });
}

/**
 * Получение выделенного текста через pbpaste (macOS)
 */
function getSelectedTextMacOS() {
  return new Promise((resolve) => {
    console.log('Using macOS method...');

    // Сохраняем текущий буфер обмена
    let originalClipboard = '';
    try {
      originalClipboard = clipboard.readText();
    } catch (err) {
      console.log('Could not read original clipboard:', err.message);
    }

    // Очищаем буфер обмена
    clipboard.clear();

    // Используем AppleScript для имитации Cmd+C
    const script = `
tell application "System Events"
    keystroke "c" using command down
end tell
delay 0.5
`;

    exec(`osascript -e '${script}'`, { timeout: 2000 }, (err, stdout, stderr) => {
      if (err) {
        console.log('AppleScript error:', err.message);
        // Восстанавливаем буфер обмена
        try {
          clipboard.writeText(originalClipboard);
        } catch (restoreErr) {
          console.log('Could not restore clipboard');
        }
        resolve(null);
        return;
      }

      // Получаем новый контент из буфера обмена
      setTimeout(() => {
        try {
          const newClipboard = clipboard.readText();
          
          // Восстанавливаем оригинальный буфер обмена
          try {
            clipboard.writeText(originalClipboard);
          } catch (restoreErr) {
            console.log('Could not restore clipboard');
          }

          if (newClipboard && newClipboard.trim() && newClipboard !== originalClipboard) {
            console.log('macOS method successful:', `"${newClipboard}"`);
            resolve(newClipboard.trim());
          } else {
            console.log('macOS method - no new content');
            resolve(null);
          }
        } catch (readErr) {
          console.log('Error reading clipboard:', readErr.message);
          resolve(null);
        }
      }, 100);
    });
  });
}

/**
 * Альтернативный метод для Windows через C# скрипт
 */
function getSelectedTextWindowsCS() {
  return new Promise((resolve) => {
    console.log('Using Windows C# method...');

    const csharpScript = `
using System;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

class Program
{
    [STAThread]
    static void Main()
    {
        try
        {
            string originalClipboard = "";
            try
            {
                originalClipboard = Clipboard.GetText(TextDataFormat.UnicodeText);
            }
            catch { }

            Clipboard.Clear();
            Thread.Sleep(50); // Минимальная задержка перед отправкой

            // Эмулируем Ctrl+C через WinAPI для надежности
            keybd_event(VK_CONTROL, 0, 0, 0);
            keybd_event(0x43, 0, 0, 0); // C
            Thread.Sleep(50);
            keybd_event(0x43, 0, KEYEVENTF_KEYUP, 0);
            keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);

            Thread.Sleep(200); // Ожидаем, пока текст попадет в буфер

            string copiedText = "";
            try
            {
                copiedText = Clipboard.GetText(TextDataFormat.UnicodeText);
            }
            catch { }

            // Восстановить оригинальный буфер обмена
            try
            {
                Clipboard.SetText(originalClipboard, TextDataFormat.UnicodeText);
            }
            catch { }

            if (!string.IsNullOrWhiteSpace(copiedText) && copiedText != originalClipboard)
            {
                Console.OutputEncoding = System.Text.Encoding.UTF8;
                Console.Write(copiedText);
            }
        }
        catch
        {
            // Игнорируем ошибки
        }
    }

    const byte VK_CONTROL = 0x11;
    const uint KEYEVENTF_KEYUP = 0x0002;

    [DllImport("user32.dll")]
    private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);
}
`;

    // Временный файл для C# кода
    const fs = require('fs');
    const path = require('path');
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `selection_${Date.now()}.cs`);

    try {
      fs.writeFileSync(tempFile, csharpScript);

      // Компилируем и запускаем C# код
      const child = spawn('powershell', [
        '-Command',
        `Add-Type -TypeDefinition (Get-Content '${tempFile}' -Raw) -ReferencedAssemblies System.Windows.Forms; [Program]::Main()`
      ], {
        windowsHide: true,
        timeout: 3000
      });

      let output = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.on('close', (code) => {
        // Удаляем временный файл
        try {
          fs.unlinkSync(tempFile);
        } catch (err) {
          // Игнорируем ошибки удаления
        }

        const result = output.trim();
        if (result) {
          console.log('C# method successful:', `"${result}"`);
          resolve(result);
        } else {
          console.log('C# method failed');
          resolve(null);
        }
      });

      child.on('error', (err) => {
        console.log('C# method spawn error:', err.message);
        try {
          fs.unlinkSync(tempFile);
        } catch (unlinkErr) {
          // Игнорируем ошибки удаления
        }
        resolve(null);
      });

    } catch (err) {
      console.log('C# method file error:', err.message);
      resolve(null);
    }
  });
}

/**
 * Основная функция для получения выделенного текста
 */
async function getSelectedText() {
  console.log('Getting selected text...');
  console.log('Platform:', process.platform);

  try {
    let result = null;

    switch (process.platform) {
      case 'win32':
        // Пробуем PowerShell метод
        result = await getSelectedTextWindows();
        if (!result) {
          console.log('PowerShell method failed, trying C# method...');
          result = await getSelectedTextWindowsCS();
        }
        break;

      case 'linux':
        result = await getSelectedTextLinux();
        break;

      case 'darwin':
        result = await getSelectedTextMacOS();
        break;

      default:
        console.log('Unsupported platform:', process.platform);
        return null;
    }

    if (result && result.trim()) {
      console.log('Successfully got selected text:', `"${result.trim()}"`);
      return result.trim();
    } else {
      console.log('No text selected or method failed');
      return null;
    }

  } catch (err) {
    console.error('Error getting selected text:', err);
    return null;
  }
}

/**
 * Функция для диагностики системы
 */
function diagnoseSystem() {
  console.log('=== System Diagnosis ===');
  console.log('Platform:', process.platform);
  console.log('OS:', os.type(), os.release());
  console.log('Node version:', process.version);

  // Тест буфера обмена
  try {
    const testText = `test_${Date.now()}`;
    clipboard.writeText(testText);
    const readBack = clipboard.readText();
    console.log('Clipboard test:', readBack === testText ? 'OK' : 'FAILED');
    clipboard.clear();
  } catch (err) {
    console.log('Clipboard test: ERROR -', err.message);
  }

  // Проверка доступности команд
  if (process.platform === 'win32') {
    exec('powershell -Command "Get-Host"', { timeout: 2000 }, (err) => {
      console.log('PowerShell availability:', err ? 'NOT AVAILABLE' : 'OK');
    });
  } else if (process.platform === 'linux') {
    exec('which xclip', (err) => {
      console.log('xclip availability:', err ? 'NOT AVAILABLE' : 'OK');
      if (err) {
        exec('which xsel', (xselErr) => {
          console.log('xsel availability:', xselErr ? 'NOT AVAILABLE' : 'OK');
        });
      }
    });
  } else if (process.platform === 'darwin') {
    exec('which osascript', (err) => {
      console.log('AppleScript availability:', err ? 'NOT AVAILABLE' : 'OK');
    });
  }

  console.log('=== End Diagnosis ===');
}

module.exports = {
  getSelectedText,
  diagnoseSystem
};