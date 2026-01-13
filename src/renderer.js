document.addEventListener('DOMContentLoaded', () => {
  const original = document.getElementById('original');
  const translated = document.getElementById('translated');
  const sourceLang = document.getElementById('sourceLang');
  const targetLang = document.getElementById('targetLang');
  const pinToggle = document.getElementById('pinToggle');
  const swapBtn = document.getElementById('swapLangs');
  const container = document.querySelector('.container');
  const themeToggle = document.getElementById('themeToggle');

  let isPinned = false;
  let isTranslating = false;

  // === ТЕМА ===

  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');

    const icon = themeToggle.querySelector('i');
    if (!icon) {
      return;
    }

    if (document.body.classList.contains('dark-theme')) {
      icon.classList.replace('fa-moon', 'fa-sun');
    } else {
      icon.classList.replace('fa-sun', 'fa-moon');
    }
  });

  // === АДАПТАЦИЯ ЛЕЙАУТА ===

  function updateLayout() {
    const textAreas = document.querySelector('.text-areas');
    const containerElement = document.querySelector('.container');

    if (!textAreas || !containerElement) {
      return;
    }

    const isHorizontal = containerElement.clientWidth > containerElement.clientHeight;
    textAreas.classList.toggle('horizontal-layout', isHorizontal);
    textAreas.classList.toggle('vertical-layout', !isHorizontal);
  }

  window.addEventListener('load', updateLayout);
  window.addEventListener('resize', updateLayout);

  // === IPC-СОБЫТИЯ ОТ MAIN ===

  window.electronAPI.onTranslateText(async (text) => {
    if (!text || !text.trim()) {
      original.focus();
      original.select();
      return;
    }

    original.value = text.trim();
    translated.value = 'Перевод...';
    sourceLang.value = 'auto';

    await translateText();
  });

  window.electronAPI.onWindowBlur(() => {
    container.classList.add('no-border');
  });

  window.electronAPI.onWindowFocus(() => {
    container.classList.remove('no-border');
  });

  window.electronAPI.onWindowHidden(() => {
    isPinned = false;
    pinToggle.classList.remove('active');
  });

  window.electronAPI.onFocusInput(() => {
    original.focus();
    original.select();
  });

  // === ЛОГИКА ПЕРЕВОДА ===

  async function translateText() {
    if (isTranslating) {
      return;
    }

    const text = original.value.trim();
    if (!text) {
      translated.value = 'Введите текст для перевода';
      return;
    }

    const from = sourceLang.value === 'auto' ? 'auto' : sourceLang.value;
    const to = targetLang.value;

    isTranslating = true;
    translated.value = 'Перевод...';

    try {
      const res = await window.electronAPI.translateAPI(text, from, to);
      if (res.error) {
        throw new Error(res.error);
      }
      translated.value = res.translatedText || 'Ошибка получения перевода';
    } catch (error) {
      translated.value = `Ошибка: ${error.message}`;
    } finally {
      isTranslating = false;
    }
  }

  // Кнопка "Перевести" добавляется динамически
  function addTranslateButton() {
    const footer = document.querySelector('.footer');
    if (!footer) {
      return;
    }

    const translateBtn = document.createElement('button');
    translateBtn.id = 'translateBtn';
    translateBtn.className = 'action-btn';
    translateBtn.textContent = 'Перевести';

    footer.insertBefore(translateBtn, footer.firstChild);
    translateBtn.addEventListener('click', translateText);
  }

  addTranslateButton();

  original.addEventListener('input', () => {
    // Зарезервировано под автоопределение/автообновление
  });

  sourceLang.addEventListener('change', () => {
    if (original.value.trim()) {
      translateText();
    }
  });

  targetLang.addEventListener('change', () => {
    if (original.value.trim()) {
      translateText();
    }
  });

  original.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      translateText();
    }
  });

  // === КНОПКИ КОПИРОВАНИЯ / ЗАМЕНЫ ===

  const copyBtn = document.getElementById('copyBtn');
  const replaceBtn = document.getElementById('replaceBtn');

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      if (
          translated.value &&
          translated.value !== 'Перевод...' &&
          !translated.value.startsWith('Ошибка:')
      ) {
        navigator.clipboard
            .writeText(translated.value)
            .then(() => {
              const toast = copyBtn.querySelector('.toast');
              if (!toast) return;
              toast.classList.remove('show');
              setTimeout(() => {
                toast.classList.add('show');
                setTimeout(() => toast.classList.remove('show'), 1000);
              }, 10);
            })
            .catch((error) => {
              console.error('Failed to copy text:', error);
            });
      }
    });
  }

  if (replaceBtn) {
    replaceBtn.addEventListener('click', () => {
      if (
          translated.value &&
          translated.value !== 'Перевод...' &&
          !translated.value.startsWith('Ошибка:')
      ) {
        const temp = original.value;
        original.value = translated.value;
        translated.value = temp;

        swapBtn.click();

        const toast = replaceBtn.querySelector('.toast');
        if (!toast) return;
        toast.classList.remove('show');
        setTimeout(() => {
          toast.classList.add('show');
          setTimeout(() => toast.classList.remove('show'), 1000);
        }, 10);
      }
    });
  }

  // === СМЕНА ЯЗЫКОВ ===

  swapBtn.addEventListener('click', () => {
    swapBtn.style.pointerEvents = 'none';
    swapBtn.classList.add('animating');

    const tempLang = sourceLang.value;
    sourceLang.value = targetLang.value;
    targetLang.value = tempLang;

    if (original.value.trim()) {
      translateText();
    }

    setTimeout(() => {
      swapBtn.classList.remove('animating');
      swapBtn.style.pointerEvents = 'auto';
    }, 400);
  });

  // === ПИН ОКНА ===

  pinToggle.addEventListener('click', () => {
    if (isPinned) {
      isPinned = false;
      pinToggle.classList.remove('active');
      window.electronAPI.hideWindow();
    } else {
      isPinned = true;
      pinToggle.classList.add('active');
      window.electronAPI.togglePin();
    }
  });

  // === ПЕРЕТАСКИВАНИЕ ОКНА ===

  let isDragging = false;
  let lastPos = { x: 0, y: 0 };

  document.addEventListener('mousedown', (event) => {
    const onDragHandle = event.target.closest('.drag-handle');
    const inInteractive =
        event.target.closest('button') ||
        event.target.closest('select') ||
        event.target.closest('textarea');

    if (onDragHandle || !inInteractive) {
      isDragging = true;
      lastPos = { x: event.screenX, y: event.screenY };
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    }
  });

  document.addEventListener('mousemove', (event) => {
    if (!isDragging) {
      return;
    }

    const dx = event.screenX - lastPos.x;
    const dy = event.screenY - lastPos.y;
    lastPos = { x: event.screenX, y: event.screenY };

    window.electronAPI.dragWindow({ x: dx, y: dy });
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
});