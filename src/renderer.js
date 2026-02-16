class TranslatorRenderer {
  constructor() {
    this.elements = {};
    this.state = {
      isPinned: false,
      isTranslating: false,
      isDragging: false,
      lastDragPos: { x: 0, y: 0 },
      currentTheme: 'light',
      themeColor: 'indigo',
      settingsOpen: false,
      currentProvider: 'mock',
      supportedLanguages: []
    };

    this.init();
  }

  async init() {
    document.addEventListener('DOMContentLoaded', async () => {
      await this.initializeApplication();
    });
  }

  async initializeApplication() {
    this.cacheElements();
    await this.loadSettings();
    await this.loadSupportedLanguages();
    this.setupEventListeners();
    this.setupElectronIPC();
    this.updateLayout();
    this.addTranslateButton();

    console.log('Translator UI initialized');
  }

  async loadSupportedLanguages() {
    try {
      if (window.electronAPI) {
        const languages = await window.electronAPI.getSupportedLanguages();
        this.state.supportedLanguages = languages;
        this.updateLanguageSelects(languages);
      }
    } catch (error) {
      console.warn('Could not load supported languages:', error);
      this.updateLanguageSelects(this.getDefaultLanguages());
    }
  }

  updateLanguageSelects(languages) {
    if (!this.elements.sourceLang || !this.elements.targetLang) return;

    const currentSource = this.elements.sourceLang.value;
    const currentTarget = this.elements.targetLang.value;

    this.elements.sourceLang.innerHTML = '';
    this.elements.targetLang.innerHTML = '';

    languages.forEach(lang => {
      const sourceOption = document.createElement('option');
      sourceOption.value = lang.code;
      sourceOption.textContent = lang.name;
      this.elements.sourceLang.appendChild(sourceOption);

      const targetOption = document.createElement('option');
      targetOption.value = lang.code;
      targetOption.textContent = lang.name;
      this.elements.targetLang.appendChild(targetOption);
    });

    if (currentSource && this.elements.sourceLang.querySelector(`option[value="${currentSource}"]`)) {
      this.elements.sourceLang.value = currentSource;
    } else {
      const enOption = this.elements.sourceLang.querySelector('option[value="en"]');
      if (enOption) enOption.selected = true;
    }

    if (currentTarget && this.elements.targetLang.querySelector(`option[value="${currentTarget}"]`)) {
      this.elements.targetLang.value = currentTarget;
    } else {
      const ruOption = this.elements.targetLang.querySelector('option[value="ru"]');
      if (ruOption) ruOption.selected = true;
    }
  }

  getDefaultLanguages() {
    const codes = ['en', 'ru', 'es', 'fr', 'de', 'zh', 'ja', 'ko', 'it', 'tr'];
    try {
      const displayNames = new Intl.DisplayNames([navigator.language], { type: 'language' });
      return codes.map(code => {
        const name = displayNames.of(code);
        return {
          code,
          name: name.charAt(0).toUpperCase() + name.slice(1)
        };
      }).sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
      return [
        { code: 'en', name: 'English' },
        { code: 'ru', name: 'Русский' }
      ];
    }
  }

  cacheElements() {
    this.elements = {
      original: document.getElementById('original'),
      translated: document.getElementById('translated'),
      sourceLang: document.getElementById('sourceLang'),
      targetLang: document.getElementById('targetLang'),
      pinToggle: document.getElementById('pinToggle'),
      swapBtn: document.getElementById('swapLangs'),
      container: document.querySelector('.container'),
      copyBtn: document.getElementById('copyBtn'),
      replaceBtn: document.getElementById('replaceBtn'),
      dragHandle: document.querySelector('.drag-handle')
    };
  }

  async loadSettings() {
    try {
      if (window.electronAPI) {
        const settings = await window.electronAPI.getAllSettings();
        if (settings) {
          this.applyTheme(settings.customization?.theme);
          this.applyThemeColor(settings.customization?.themeColor);

          this.state.currentTheme = settings.customization?.theme || 'light';
          this.state.themeColor = settings.customization?.themeColor || 'indigo';
        }
      }
    } catch (error) {
      console.warn('Could not load settings:', error);
      this.applyLightTheme();
    }
  }

  setupEventListeners() {
    this.setTextAreaEvents();
    this.setupButtonEvents();
    this.setupDragEvents();
    this.setupWindowEvents();
    this.setupLanguageEvents();
  }

  setupElectronIPC() {
    if (!window.electronAPI) return;

    window.electronAPI.onTranslateText(async (text) => {
      await this.handleIncomingText(text);
    });

    window.electronAPI.onFocusInput(() => {
      this.focusOriginalTextarea(true);
    });

    window.electronAPI.onWindowBlur(() => {
      this.elements.container?.classList.add('no-border');
      this.closeSettingsIfOpen();
    });

    window.electronAPI.onProviderChanged((providerSettings) => {
      this.state.currentProvider = providerSettings.name;
      this.loadSupportedLanguages();
    });

    window.electronAPI.onWindowFocus(() => {
      this.elements.container?.classList.remove('no-border');
      this.closeSettingsIfOpen();
    });

    window.electronAPI.onWindowHidden(() => {
      this.updatePinState(false);
      this.closeSettingsIfOpen();
    });

    window.electronAPI.onWindowShown(() => {
      this.closeSettingsIfOpen();
    });

    window.electronAPI.onPinStateChanged((isPinned) => {
      this.updatePinState(isPinned);
    });

    window.electronAPI.onThemeChanged((theme) => {
      this.applyTheme(theme);
      this.state.currentTheme = theme;
    });

    window.electronAPI.onThemeColorChanged((color) => {
      this.applyThemeColor(color);
      this.state.themeColor = color;
    });
  }

  closeSettingsIfOpen() {
    if (window.settingsRenderer && window.settingsRenderer.isSettingsOpen) {
      window.settingsRenderer.hideSettings();
    }
  }

  updateSettingsState(isOpen) {
    this.state.settingsOpen = isOpen;
  }

  applyTheme(theme) {
    if (theme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }

  applyThemeColor(color) {
    const colorMap = {
      indigo: { primary: '#6366f1', dark: '#4f46e5' },
      blue: { primary: '#3b82f6', dark: '#2563eb' },
      emerald: { primary: '#10b981', dark: '#059669' },
      purple: { primary: '#8b5cf6', dark: '#7c3aed' },
      rose: { primary: '#f43f5e', dark: '#e11d48' },
      amber: { primary: '#f59e0b', dark: '#d97706' },
      slate: { primary: '#64748b', dark: '#475569' }
    };

    const colors = colorMap[color] || colorMap.indigo;

    document.documentElement.style.setProperty('--primary', colors.primary);
    document.documentElement.style.setProperty('--primary-dark', colors.dark);
  }

  updatePinState(isPinned) {
    this.state.isPinned = isPinned;
    this.updatePinButton(isPinned);
  }

  updatePinButton(isPinned) {
    if (!this.elements.pinToggle) return;

    this.elements.pinToggle.classList.toggle('active', isPinned);

    const icon = this.elements.pinToggle.querySelector('i');
    if (!icon) return;

    if (isPinned) {
      icon.classList.remove('fa-thumbtack');
      icon.classList.add('fa-times');
      icon.title = 'Открепить и скрыть';
    } else {
      icon.classList.remove('fa-times');
      icon.classList.add('fa-thumbtack');
      icon.title = 'Закрепить окно';
    }
  }

  async handleIncomingText(text) {
    if (!text || !text.trim()) {
      this.focusOriginalTextarea(true);
      return;
    }

    this.elements.original.value = text.trim();
    this.focusOriginalTextarea(false);
    await this.translateText(false);
  }

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

  setTextAreaEvents() {
    if (!this.elements.original) return;

    this.elements.original.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        this.translateText(false);
      }
    });

    let debounceTimer;
    this.elements.original.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      if (this.shouldUseLiveTranslation()) {
        debounceTimer = setTimeout(() => {
          if (this.elements.original.value.trim()) {
            this.translateText(false);
          }
        }, 500);
      }
    });
  }

  shouldUseLiveTranslation() {
    return true;
  }

  setupButtonEvents() {
    if (this.elements.replaceBtn) {
      this.elements.replaceBtn.addEventListener('click', () => this.swapText());
    }

    if (this.elements.copyBtn) {
      this.elements.copyBtn.addEventListener('click', () => this.copyTranslatedText());
    }

    if (this.elements.swapBtn) {
      this.elements.swapBtn.addEventListener('click', () => this.swapLanguages());
    }

    if (this.elements.pinToggle) {
      this.elements.pinToggle.addEventListener('click', () => this.togglePin());
    }
  }

  setupLanguageEvents() {
    if (!this.elements.sourceLang || !this.elements.targetLang) return;

    this.elements.sourceLang.addEventListener('change', () => {
      if (this.elements.original.value.trim()) {
        this.translateText(true);
      }
    });

    this.elements.targetLang.addEventListener('change', () => {
      if (this.elements.original.value.trim()) {
        this.translateText(true);
      }
    });
  }

  addTranslateButton() {
    const footer = document.querySelector('.footer');
    if (!footer) return;

    const existingBtn = document.getElementById('translateBtn');
    if (existingBtn) return;

    const translateBtn = document.createElement('button');
    translateBtn.id = 'translateBtn';
    translateBtn.className = 'action-btn';
    translateBtn.innerHTML = '<i class="fas fa-language"></i> <span class="btn-text">Перевести</span>';
    translateBtn.addEventListener('click', () => this.translateText(false));

    footer.insertBefore(translateBtn, footer.firstChild);
  }

  setupDragEvents() {
    let dragHandle = this.elements.dragHandle;
    if (!dragHandle) {
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

  startDragging(event) {
    this.state.isDragging = true;
    this.state.lastDragPos = { x: event.screenX, y: event.screenY };
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  }

  handleDragging(event) {
    const dx = event.screenX - this.state.lastDragPos.x;
    const dy = event.screenY - this.state.lastDragPos.y;
    this.state.lastDragPos = { x: event.screenX, y: event.screenY };

    if (window.electronAPI) {
      window.electronAPI.dragWindow({ x: dx, y: dy });
    }
  }

  stopDragging() {
    this.state.isDragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  setupWindowEvents() {
    window.addEventListener('load', () => this.updateLayout());
    window.addEventListener('resize', () => this.updateLayout());
  }

  updateLayout() {
    const textAreas = document.querySelector('.text-areas');
    const containerElement = this.elements.container;

    if (!textAreas || !containerElement) return;

    const isHorizontal = containerElement.clientWidth > containerElement.clientHeight;
    textAreas.classList.toggle('horizontal-layout', isHorizontal);
    textAreas.classList.toggle('vertical-layout', !isHorizontal);
  }

  async translateText(isManualSelect = false) {
    if (this.state.isTranslating) return;

    const text = this.elements.original.value.trim();
    if (!text) {
      if (this.elements.translated) {
        this.elements.translated.value = 'Введите текст для перевода';
      }
      return;
    }

    const from = isManualSelect ? this.elements.sourceLang.value : 'auto';
    const to = this.elements.targetLang.value;

    this.state.isTranslating = true;

    if (this.elements.translated) {
      this.elements.translated.value = 'Перевод...';
    }

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

        if (result.sourceLang) {
          this.elements.sourceLang.value = result.sourceLang;
        }
        if (result.targetLang) {
          this.elements.targetLang.value = result.targetLang;
        }

        if (result.provider && result.provider !== 'mock') {
          this.showToast(this.elements.translated, `Переведено с помощью ${result.provider}`, 3000);
        }
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

  async copyTranslatedText() {
    if (!this.elements.translated) return;

    const text = this.elements.translated.value;

    if (!text || text === 'Перевод...' || text.startsWith('Ошибка:')) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      this.showToast(this.elements.copyBtn, 'Скопировано!');
    } catch (error) {
      console.error('Failed to copy text:', error);
      this.showToast(this.elements.copyBtn, 'Ошибка копирования!');
    }
  }

  swapText() {
    if (!this.elements.original || !this.elements.translated) return;

    const originalText = this.elements.original.value;
    const translatedText = this.elements.translated.value;

    if (!translatedText || translatedText === 'Перевод...' || translatedText.startsWith('Ошибка:')) {
      return;
    }

    this.elements.original.value = translatedText;
    this.elements.translated.value = originalText;

    this.swapLanguages();
    this.showToast(this.elements.replaceBtn, 'Текст заменен!');
  }

  swapLanguages() {
    if (!this.elements.swapBtn || !this.elements.sourceLang || !this.elements.targetLang) return;

    this.elements.swapBtn.style.pointerEvents = 'none';
    this.elements.swapBtn.classList.add('animating');

    const tempLang = this.elements.sourceLang.value;
    this.elements.sourceLang.value = this.elements.targetLang.value;
    this.elements.targetLang.value = tempLang;

    if (this.elements.original.value.trim()) {
      this.translateText(true);
    }

    setTimeout(() => {
      this.elements.swapBtn.classList.remove('animating');
      this.elements.swapBtn.style.pointerEvents = 'auto';
    }, 400);
  }

  togglePin() {
    if (this.state.isPinned) {
      if (window.electronAPI) {
        this.updatePinState(false);
        window.electronAPI.hideWindow();
      }
    } else {
      if (window.electronAPI) {
        window.electronAPI.togglePin();
      }
    }
  }

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

new TranslatorRenderer();