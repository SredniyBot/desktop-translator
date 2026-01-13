document.addEventListener('DOMContentLoaded', () => {
  const original    = document.getElementById('original');
  const translated  = document.getElementById('translated');
  const sourceLang  = document.getElementById('sourceLang');
  const targetLang  = document.getElementById('targetLang');
  const pinToggle   = document.getElementById('pinToggle');
  const swapBtn     = document.getElementById('swapLangs');
  const container   = document.querySelector('.container');
  const themeToggle = document.getElementById('themeToggle');

  let currentText = '';
  let isPinned = false;
  let isTranslating = false;

  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    const icon = themeToggle.querySelector('i');
    
    if (document.body.classList.contains('dark-theme')) {
      icon.classList.replace('fa-moon', 'fa-sun');
    } else {
      icon.classList.replace('fa-sun', 'fa-moon');
    }
  });

  function updateLayout() {
    const textAreas = document.querySelector('.text-areas');
    const container = document.querySelector('.container');
    
    if (container.clientWidth > container.clientHeight) {
      textAreas.classList.remove('vertical-layout');
      textAreas.classList.add('horizontal-layout');
    } else {
      textAreas.classList.remove('horizontal-layout');
      textAreas.classList.add('vertical-layout');
    }
  }

  window.addEventListener('load', updateLayout);
  window.addEventListener('resize', updateLayout);

  window.electronAPI.onTranslateText(async (text) => {
    if (!text || !text.trim()) {
      original.focus();
      original.select();
      return;
    }

    original.value = text.trim();
    translated.value = 'Перевод...';
    currentText = text.trim();
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

  async function translateText() {
    if (isTranslating) return;

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
    } catch (e) {
      translated.value = 'Ошибка: ' + e.message;
    } finally {
      isTranslating = false;
    }
  }

  function addTranslateButton() {
    const footer = document.querySelector('.footer');
    const translateBtn = document.createElement('button');
    translateBtn.id = 'translateBtn';
    translateBtn.className = 'action-btn';
    translateBtn.innerHTML = `
      <i class="fas fa-language"></i>
      <span class="btn-text">Перевести</span>
    `;
    footer.insertBefore(translateBtn, footer.firstChild);
    
    translateBtn.addEventListener('click', translateText);
  }
  
  addTranslateButton();

  original.addEventListener('input', () => {
    currentText = original.value;
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

  original.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      translateText();
    }
  });

  document.getElementById('copyBtn').addEventListener('click', () => {
    if (translated.value && translated.value !== 'Перевод...' && !translated.value.startsWith('Ошибка:')) {
      navigator.clipboard.writeText(translated.value).then(() => {
        const toast = document.querySelector('#copyBtn .toast');
        toast.classList.remove('show');
        setTimeout(() => {
          toast.classList.add('show');
          setTimeout(() => toast.classList.remove('show'), 1000);
        }, 10);
      }).catch(err => {
        console.error('Failed to copy text:', err);
      });
    }
  });

  document.getElementById('replaceBtn').addEventListener('click', () => {
    if (translated.value && translated.value !== 'Перевод...' && !translated.value.startsWith('Ошибка:')) {
      const temp = original.value;
      original.value = translated.value;
      translated.value = temp;
      swapBtn.click();
      
      const toast = document.querySelector('#replaceBtn .toast');
      toast.classList.remove('show');
      setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 1000);
      }, 10);
    }
  });

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

  let isDragging = false;
  let lastPos = { x: 0, y: 0 };

  document.addEventListener('mousedown', e => {
    if (e.target.closest('.drag-handle') || 
        (!e.target.closest('button') && 
         !e.target.closest('select') && 
         !e.target.closest('textarea'))) {
      isDragging = true;
      lastPos = { x: e.screenX, y: e.screenY };
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    }
  });

  document.addEventListener('mousemove', e => {
    if (!isDragging) return;
    const dx = e.screenX - lastPos.x;
    const dy = e.screenY - lastPos.y;
    lastPos = { x: e.screenX, y: e.screenY };
    window.electronAPI.dragWindow({ x: dx, y: dy });
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
});