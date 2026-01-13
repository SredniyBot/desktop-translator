const { clipboard } = require('electron');
const robot = require('robotjs');

/**
 * Универсальный способ получить текущий выделенный текст
 * через эмуляцию системного копирования (Ctrl/Cmd + C).
 * Оригинальный буфер обмена восстанавливается с задержкой,
 * чтобы не сломать поведение для пользователя.
 */
async function getSelectedText() {
  const originalText = clipboard.readText();
  clipboard.clear();

  const modifier = process.platform === 'darwin' ? 'command' : 'control';
  robot.keyTap('c', modifier);

  await new Promise((resolve) => setTimeout(resolve, 200));

  const selectedText = clipboard.readText();

  if (selectedText !== originalText) {
    setTimeout(() => {
      clipboard.writeText(originalText);
    }, 1000);
  }

  return selectedText.trim() || null;
}

function diagnoseSystem() {
  console.log('Selection module ready');
}

module.exports = {
  getSelectedText,
  diagnoseSystem
};
