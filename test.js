// poll-selected-text.js
const robot = require('robotjs');
let clipboardy = require('clipboardy');

// Если require вернул { default: {...} }, то используем именно вложенный объект
if (clipboardy && clipboardy.default && typeof clipboardy.default === 'object') {
  clipboardy = clipboardy.default;
}

// Интервалы и задержка
const COPY_DELAY_MS = 50;   // мс — пауза после Ctrl+C
const POLL_INTERVAL  = 500; // мс — как часто идёт опрос

// Выбираем чита/пишем-методы из clipboardy
let readClipboard, writeClipboard;
if (typeof clipboardy.readSync === 'function' && typeof clipboardy.writeSync === 'function') {
  readClipboard  = () => clipboardy.readSync();
  writeClipboard = text => clipboardy.writeSync(text);
} else if (typeof clipboardy.read === 'function' && typeof clipboardy.write === 'function') {
  readClipboard  = () => clipboardy.read();
  writeClipboard = text => clipboardy.write(text);
} else {
  console.error('В этом экземпляре clipboardy нет ни readSync/writeSync, ни read/write');
  process.exit(1);
}

/**
 * Копирует выделенный текст в активном окне через Ctrl+C/⌘+C
 * и возвращает его (или пустую строку).
 */
async function getSelectedText() {
  // 1) Сохраняем предыдущий буфер
  const prev = await Promise.resolve(readClipboard());

  // 2) Эмулируем Ctrl+C или ⌘+C
  const modifier = process.platform === 'darwin' ? 'command' : 'control';
  robot.keyTap('c', modifier);

  // 3) Ждём, чтобы текст появился в буфере
  await new Promise(r => setTimeout(r, COPY_DELAY_MS));

  // 4) Читаем новый буфер
  const text = await Promise.resolve(readClipboard());

  // 5) Восстанавливаем старый буфер
  await Promise.resolve(writeClipboard(prev));

  // 6) Возвращаем текст (или пустую строку)
  return text || '';
}

// Запуск поллинга
setInterval(async () => {
  try {
    const txt = await getSelectedText();
    console.log(
      `[${new Date().toLocaleTimeString()}] Выделено:`,
      txt === '' ? '<пусто>' : txt
    );
  } catch (err) {
    console.error('Ошибка при попытке получить выделенный текст:', err);
  }
}, POLL_INTERVAL);
