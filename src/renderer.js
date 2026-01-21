/**
 * Translator Renderer
 * Полная версия с функциональностью всех кнопок и интерфейса
 */

class TranslatorRenderer {
  constructor() {
    this.elements = {};
    this.state = {
      isPinned: false,
      isTranslating: false,
      isDragging: false,
      lastDragPos: { x: 0, y: 0 },
      currentTheme: 'light'
    };

    this.init();
  }

  /**
   * Инициализация приложения
   */
  init() {
    document.addEventListener('DOMContentLoaded', () => {
      this.cacheElements();
      this.setupEventListeners();
      this.setupElectronIPC();
      this.updateLayout();
      this.addTranslateButton();

      console.log('Translator UI initialized');
    });
  }

  /**
   * Кэширует DOM элементы
   */
  cacheElements() {
    this.elements = {
      original: document.getElementById('original'),
      translated: document.getElementById('translated'),
      sourceLang: document.getElementById('sourceLang'),
      targetLang: document.getElementById('targetLang'),
      pinToggle: document.getElementById('pinToggle'),
      swapBtn: document.getElementById('swapLangs'),
      container: document.querySelector('.container'),
      themeToggle: document.getElementById('themeToggle'),
      copyBtn: document.getElementById('copyBtn'),
      replaceBtn: document.getElementById('replaceBtn'),
      dragHandle: document.querySelector('.drag-handle')
    };

    console.log('Cached elements:', Object.keys(this.elements));
  }

  /**
   * Настраивает обработчики событий DOM
   */
  setupEventListeners() {
    this.setupThemeToggle();
    this.setupTextAreaEvents();
    this.setupButtonEvents();
    this.setupDragEvents();
    this.setupWindowEvents();
    this.setupLanguageEvents();
  }

  /**
   * Настраивает обработчики IPC событий от Electron
   */
  setupElectronIPC() {
    if (!window.electronAPI) {
      console.error('Electron API not available');
      return;
    }

    // Получение текста для перевода
    window.electronAPI.onTranslateText(async (text) => {
      await this.handleIncomingText(text);
    });

    // Фокус на поле ввода
    window.electronAPI.onFocusInput(() => {
      this.focusOriginalTextarea(true);
    });

    // События окна
    window.electronAPI.onWindowBlur(() => {
      this.elements.container?.classList.add('no-border');
    });

    window.electronAPI.onWindowFocus(() => {
      this.elements.container?.classList.remove('no-border');
    });

    window.electronAPI.onWindowHidden(() => {
      this.state.isPinned = false;
      this.elements.pinToggle?.classList.remove('active');
    });

    // Изменение состояния пина
    window.electronAPI.onPinStateChanged((isPinned) => {
      this.state.isPinned = isPinned;
      if (this.elements.pinToggle) {
        this.elements.pinToggle.classList.toggle('active', isPinned);
      }
    });

    console.log('Electron IPC handlers set up');
  }

  /**
   * Обрабатывает входящий текст для перевода
   */
  async handleIncomingText(text) {
    console.log('Handling incoming text:', text?.substring(0, 50));

    if (!text || !text.trim()) {
      this.focusOriginalTextarea(true);
      return;
    }

    // Вставляем текст в textarea
    this.elements.original.value = text.trim();

    // Фокусируем и устанавливаем курсор в конец
    this.focusOriginalTextarea(false);

    // Устанавливаем автоопределение языка
    if (this.elements.sourceLang) {
      this.elements.sourceLang.value = 'auto';
    }

    // Запускаем перевод
    await this.translateText();
  }

  /**
   * Фокусирует поле ввода текста
   */
  focusOriginalTextarea(selectAll = false) {
    if (!this.elements.original) return;

    this.elements.original.focus();

    if (selectAll) {
      this.elements.original.select();
    } else {
      const textLength = this.elements.original.value.length;
      this.elements.original.setSelectionRange(textLength, textLength);
      this.elements.original.scrollTop = this.elements.original.scrollHeight;
    }
  }

  /**
   * Настраивает переключение темы
   */
  setupThemeToggle() {
    if (!this.elements.themeToggle) return;

    this.elements.themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-theme');

      const icon = this.elements.themeToggle.querySelector('i');
      if (!icon) return;

      if (document.body.classList.contains('dark-theme')) {
        icon.classList.replace('fa-moon', 'fa-sun');
        this.state.currentTheme = 'dark';
      } else {
        icon.classList.replace('fa-sun', 'fa-moon');
        this.state.currentTheme = 'light';
      }

      console.log('Theme toggled to:', this.state.currentTheme);
    });
  }

  /**
   * Настраивает события textarea
   */
  setupTextAreaEvents() {
    if (!this.elements.original) return;

    // Ctrl+Enter для перевода
    this.elements.original.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        this.translateText();
      }
    });

    // Автоматический перевод при изменении текста (с дебаунсом)
    let debounceTimer;
    this.elements.original.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (this.elements.original.value.trim()) {
          this.translateText();
        }
      }, 500);
    });
  }

  /**
   * Настраивает события кнопок
   */
  setupButtonEvents() {
    // Кнопка замены текста
    if (this.elements.replaceBtn) {
      this.elements.replaceBtn.addEventListener('click', () => this.swapText());
    }

    // Кнопка копирования перевода
    if (this.elements.copyBtn) {
      this.elements.copyBtn.addEventListener('click', () => this.copyTranslatedText());
    }

    // Кнопка смены языков
    if (this.elements.swapBtn) {
      this.elements.swapBtn.addEventListener('click', () => this.swapLanguages());
    }

    // Кнопка закрепления окна
    if (this.elements.pinToggle) {
      this.elements.pinToggle.addEventListener('click', () => this.togglePin());
    }
  }

  /**
   * Настраивает события для выбора языков
   */
  setupLanguageEvents() {
    if (!this.elements.sourceLang || !this.elements.targetLang) return;

    this.elements.sourceLang.addEventListener('change', () => {
      if (this.elements.original.value.trim()) {
        this.translateText();
      }
    });

    this.elements.targetLang.addEventListener('change', () => {
      if (this.elements.original.value.trim()) {
        this.translateText();
      }
    });
  }

  /**
   * Добавляет кнопку перевода
   */
  addTranslateButton() {
    const footer = document.querySelector('.footer');
    if (!footer) {
      console.warn('Footer element not found');
      return;
    }

    // Проверяем, не добавлена ли уже кнопка
    const existingBtn = document.getElementById('translateBtn');
    if (existingBtn) return;

    const translateBtn = document.createElement('button');
    translateBtn.id = 'translateBtn';
    translateBtn.className = 'action-btn';
    translateBtn.innerHTML = '<i class="fas fa-language"></i> Перевести';
    translateBtn.addEventListener('click', () => this.translateText());

    footer.insertBefore(translateBtn, footer.firstChild);
    console.log('Translate button added');
  }

  /**
   * Настраивает перетаскивание окна
   */
  setupDragEvents() {
    // Находим или создаем drag handle
    let dragHandle = this.elements.dragHandle;
    if (!dragHandle) {
      // Создаем drag handle если его нет
      dragHandle = document.createElement('div');
      dragHandle.className = 'drag-handle';
      dragHandle.innerHTML = '<i class="fas fa-grip-lines"></i>';
      document.querySelector('.header')?.appendChild(dragHandle);
    }

    document.addEventListener('mousedown', (event) => {
      const onDragHandle = event.target.closest('.drag-handle');
      const inInteractive = event.target.closest('button') ||
          event.target.closest('select') ||
          event.target.closest('textarea') ||
          event.target.closest('input');

      if (onDragHandle || (!inInteractive && !event.target.closest('.action-btn'))) {
        this.startDragging(event);
      }
    });

    document.addEventListener('mousemove', (event) => {
      if (this.state.isDragging) {
        this.handleDragging(event);
      }
    });

    document.addEventListener('mouseup', () => {
      this.stopDragging();
    });
  }

  /**
   * Начинает перетаскивание окна
   */
  startDragging(event) {
    this.state.isDragging = true;
    this.state.lastDragPos = { x: event.screenX, y: event.screenY };
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  }

  /**
   * Обрабатывает перетаскивание окна
   */
  handleDragging(event) {
    const dx = event.screenX - this.state.lastDragPos.x;
    const dy = event.screenY - this.state.lastDragPos.y;
    this.state.lastDragPos = { x: event.screenX, y: event.screenY };

    if (window.electronAPI) {
      window.electronAPI.dragWindow({ x: dx, y: dy });
    }
  }

  /**
   * Завершает перетаскивание окна
   */
  stopDragging() {
    this.state.isDragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  /**
   * Настраивает обработчики событий окна
   */
  setupWindowEvents() {
    window.addEventListener('load', () => this.updateLayout());
    window.addEventListener('resize', () => this.updateLayout());
  }

  /**
   * Обновляет layout в зависимости от размера окна
   */
  updateLayout() {
    const textAreas = document.querySelector('.text-areas');
    const containerElement = this.elements.container;

    if (!textAreas || !containerElement) return;

    const isHorizontal = containerElement.clientWidth > containerElement.clientHeight;
    textAreas.classList.toggle('horizontal-layout', isHorizontal);
    textAreas.classList.toggle('vertical-layout', !isHorizontal);
  }

  /**
   * Выполняет перевод текста
   */
  async translateText() {
    if (this.state.isTranslating) {
      console.log('Translation already in progress');
      return;
    }

    const text = this.elements.original.value.trim();
    if (!text) {
      if (this.elements.translated) {
        this.elements.translated.value = 'Введите текст для перевода';
      }
      return;
    }

    const from = this.elements.sourceLang.value === 'auto' ? 'auto' : this.elements.sourceLang.value;
    const to = this.elements.targetLang.value;

    this.state.isTranslating = true;

    if (this.elements.translated) {
      this.elements.translated.value = 'Перевод...';
    }

    console.log('Translating text:', { textLength: text.length, from, to });

    try {
      if (!window.electronAPI) {
        throw new Error('Electron API not available');
      }

      const result = await window.electronAPI.translateAPI(text, from, to);

      if (result.error) {
        throw new Error(result.error);
      }

      if (this.elements.translated) {
        this.elements.translated.value = result.translatedText || 'Ошибка получения перевода';
      }
    } catch (error) {
      console.error('Translation error:', error);
      if (this.elements.translated) {
        this.elements.translated.value = `Ошибка: ${error.message}`;
      }
    } finally {
      this.state.isTranslating = false;
    }
  }

  /**
   * Копирует переведенный текст в буфер обмена
   */
  async copyTranslatedText() {
    if (!this.elements.translated) return;

    const text = this.elements.translated.value;

    if (!text ||
        text === 'Перевод...' ||
        text.startsWith('Ошибка:')) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      this.showToast(this.elements.copyBtn, 'Скопировано!');
      console.log('Text copied to clipboard');
    } catch (error) {
      console.error('Failed to copy text:', error);
      this.showToast(this.elements.copyBtn, 'Ошибка копирования!');
    }
  }

  /**
   * Меняет местами оригинальный и переведенный текст
   */
  swapText() {
    if (!this.elements.original || !this.elements.translated) return;

    const originalText = this.elements.original.value;
    const translatedText = this.elements.translated.value;

    if (!translatedText ||
        translatedText === 'Перевод...' ||
        translatedText.startsWith('Ошибка:')) {
      return;
    }

    this.elements.original.value = translatedText;
    this.elements.translated.value = originalText;

    // Смена языков местами
    this.swapLanguages();
    this.showToast(this.elements.replaceBtn, 'Текст заменен!');
  }

  /**
   * Меняет языки местами
   */
  swapLanguages() {
    if (!this.elements.swapBtn || !this.elements.sourceLang || !this.elements.targetLang) return;

    // Блокируем кнопку на время анимации
    this.elements.swapBtn.style.pointerEvents = 'none';
    this.elements.swapBtn.classList.add('animating');

    const tempLang = this.elements.sourceLang.value;
    this.elements.sourceLang.value = this.elements.targetLang.value;
    this.elements.targetLang.value = tempLang;

    // Переводим текст, если он есть
    if (this.elements.original.value.trim()) {
      this.translateText();
    }

    // Возвращаем кнопку в нормальное состояние
    setTimeout(() => {
      this.elements.swapBtn.classList.remove('animating');
      this.elements.swapBtn.style.pointerEvents = 'auto';
    }, 400);
  }

  /**
   * Переключает режим закрепления окна
   */
  togglePin() {
    if (this.state.isPinned) {
      this.state.isPinned = false;
      if (this.elements.pinToggle) {
        this.elements.pinToggle.classList.remove('active');
      }
      if (window.electronAPI) {
        window.electronAPI.hideWindow();
      }
    } else {
      this.state.isPinned = true;
      if (this.elements.pinToggle) {
        this.elements.pinToggle.classList.add('active');
      }
      if (window.electronAPI) {
        window.electronAPI.togglePin();
      }
    }
    console.log('Pin toggled:', this.state.isPinned);
  }

  /**
   * Показывает временное уведомление
   */
  showToast(element, message) {
    if (!element) return;

    let toast = element.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      element.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.remove('show');

    setTimeout(() => {
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 1000);
    }, 10);
  }
}

// Запускаем приложение
new TranslatorRenderer();