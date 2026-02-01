// File: src/settings/SettingsRenderer.js
/**
 * Профессиональный рендерер панели настроек
 * Минималистичный дизайн с работающей темой и зависимыми полями
 */
class SettingsRenderer {
    constructor() {
        this.elements = {};
        this.store = null;
        this.isInitialized = false;
        this.isSettingsOpen = false;
        this.debounceTimers = new Map();
        this.currentValues = {};
    }

    async initialize() {
        if (this.isInitialized) return;
        try {
            await this.waitForElectronAPI();
            this.cacheElements();
            this.setupEventListeners();
            await this.loadSettings();
            this.isInitialized = true;

            console.log('Settings renderer initialized');
        } catch (error) {
            console.error('Failed to initialize settings renderer:', error);
            throw error;
        }
    }

    async waitForElectronAPI() {
        return new Promise((resolve) => {
            const checkAPI = () => {
                if (window.electronAPI) {
                    resolve();
                } else {
                    setTimeout(checkAPI, 100);
                }
            };
            checkAPI();
        });
    }

    cacheElements() {
        this.elements = {
            settingsPanel: document.getElementById('settingsPanel'),
            settingsToggle: document.getElementById('settingsToggle'),
            closeSettings: document.getElementById('closeSettings'),
            settingsContent: document.getElementById('settingsContent'),
            pinToggle: document.getElementById('pinToggle')
        };
    }

    setupEventListeners() {
        if (this.elements.settingsToggle) {
            this.elements.settingsToggle.addEventListener('click', () => this.toggleSettings());
        }

        if (this.elements.closeSettings) {
            this.elements.closeSettings.addEventListener('click', () => this.hideSettings());
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isSettingsOpen) {
                this.hideSettings();
            }
        });

        if (window.electronAPI) {
            window.electronAPI.onWindowBlur(() => {
                if (this.isSettingsOpen) {
                    this.hideSettings();
                }
            });
            window.electronAPI.onWindowHidden(() => {
                if (this.isSettingsOpen) {
                    this.hideSettings();
                }
            });
            window.electronAPI.onWindowShown(() => {
                this.hideSettings();
            });
        }
    }

    async loadSettings() {
        try {
            if (!window.electronAPI) return;
            const structure = await window.electronAPI.getSettingsStructure();
            const currentSettings = await window.electronAPI.getAllSettings();
            this.currentValues = currentSettings;

            this.renderSettings(structure);
            // После рендера обновляем видимость полей
            this.updateVisibility();

            console.log('Settings loaded and rendered');
        } catch (error) {
            console.error('Failed to load settings:', error);
            this.showNotification('Ошибка загрузки настроек', 'error');
        }
    }

    renderSettings(structure) {
        if (!this.elements.settingsContent) return;
        this.elements.settingsContent.innerHTML = '';

        let itemIndex = 0;

        structure.forEach((section, sectionIndex) => {
            const sectionElement = this.createSection(section, sectionIndex, itemIndex);
            this.elements.settingsContent.appendChild(sectionElement);
            itemIndex++;
        });
        this.addResetButton();
    }

    createSection(section, sectionIndex, itemIndex) {
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'settings-section';
        sectionDiv.dataset.sectionId = section.id;
        sectionDiv.style.setProperty('--item-index', itemIndex);

        const header = this.createSectionHeader(section);
        sectionDiv.appendChild(header);

        const settingsList = document.createElement('div');
        settingsList.className = 'settings-list';
        section.settings.forEach((setting, settingIndex) => {
            setting.itemIndex = itemIndex + settingIndex + 1;
            const settingElement = this.createSettingElement(setting);
            settingsList.appendChild(settingElement);
        });
        sectionDiv.appendChild(settingsList);

        return sectionDiv;
    }

    createSectionHeader(section) {
        const header = document.createElement('div');
        header.className = 'section-header';

        const icon = document.createElement('i');
        icon.className = section.icon;

        const titleDiv = document.createElement('div');
        titleDiv.className = 'section-title';
        const title = document.createElement('h3');
        title.textContent = section.title;

        const description = document.createElement('p');
        description.className = 'section-description';
        description.textContent = section.description || '';

        titleDiv.appendChild(title);
        titleDiv.appendChild(description);

        header.appendChild(icon);
        header.appendChild(titleDiv);

        return header;
    }

    createSettingElement(setting) {
        const div = document.createElement('div');
        div.className = 'setting-item';
        div.dataset.settingId = setting.id;
        div.dataset.type = setting.type;
        div.style.setProperty('--item-index', setting.itemIndex || 0);

        // Добавляем атрибуты для логики зависимости
        if (setting.dependsOn) {
            div.dataset.dependsOn = setting.dependsOn;

            if (setting.showFor) {
                div.dataset.showFor = JSON.stringify(setting.showFor);
            }
            if (setting.hideFor) {
                div.dataset.hideFor = JSON.stringify(setting.hideFor);
            }
        }

        if (setting.type === 'toggle') {
            return this.createToggleSettingElement(setting, div);
        }

        const labelContainer = document.createElement('div');
        labelContainer.className = 'setting-label-container';

        const label = document.createElement('label');
        label.textContent = setting.label;
        label.htmlFor = `setting-${setting.id}`;
        labelContainer.appendChild(label);
        if (setting.description) {
            const description = document.createElement('div');
            description.className = 'setting-description';
            description.textContent = setting.description;
            labelContainer.appendChild(description);
        }

        div.appendChild(labelContainer);

        const control = this.createControlElement(setting);
        if (control) {
            const controlContainer = document.createElement('div');
            controlContainer.className = 'control-container';
            controlContainer.appendChild(control);
            div.appendChild(controlContainer);
        }

        return div;
    }

    // Изменил сигнатуру для переиспользования div с data-атрибутами
    createToggleSettingElement(setting, div) {
        div.classList.add('setting-item-toggle');

        const textContainer = document.createElement('div');
        textContainer.className = 'toggle-text-container';
        const label = document.createElement('label');
        label.textContent = setting.label;
        label.htmlFor = `setting-${setting.id}`;
        textContainer.appendChild(label);
        if (setting.description) {
            const description = document.createElement('div');
            description.className = 'setting-description';
            description.textContent = setting.description;
            textContainer.appendChild(description);
        }

        div.appendChild(textContainer);

        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'toggle-container';
        const toggle = document.createElement('label');
        toggle.className = 'toggle-switch';
        toggle.innerHTML = `
            <input type="checkbox" id="setting-${setting.id}" data-setting="${setting.id}">
            <span class="toggle-slider"></span>
        `;
        const currentValue = this.getSettingValue(setting.id);
        const isChecked = setting.valueOn ?
            currentValue === setting.valueOn :
            Boolean(currentValue);
        const input = toggle.querySelector('input');
        input.checked = isChecked;

        input.addEventListener('change', async (e) => {
            const value = setting.valueOn ?
                (e.target.checked ? setting.valueOn : setting.valueOff) :
                e.target.checked;

            await this.updateSetting(setting.id, value);

            if (setting.id === 'customization.theme') {
                this.applyTheme(value);
            }
        });
        toggleContainer.appendChild(toggle);
        div.appendChild(toggleContainer);

        return div;
    }

    createControlElement(setting) {
        const handlers = {
            toggle: () => this.createToggleControl(setting),
            select: () => this.createSelectControl(setting),
            text: () => this.createTextControl(setting),
            color: () => this.createColorControl(setting),
            list: () => this.createListControl(setting),
            button: () => this.createButtonControl(setting),
            apiKey: () => this.createApiKeyControl(setting)
        };
        const handler = handlers[setting.type];
        return handler ? handler() : null;
    }

    createToggleControl(setting) {
        // (Оставлено для совместимости, но основная логика в createToggleSettingElement)
        const container = document.createElement('div');
        container.className = 'toggle-control-container';
        // ... (код аналогичен, сокращено для краткости, так как используется редко для toggle)
        return container;
    }

    createSelectControl(setting) {
        const container = document.createElement('div');
        container.className = 'select-container';

        const select = document.createElement('select');
        select.id = `setting-${setting.id}`;
        select.dataset.setting = setting.id;
        select.className = 'setting-select';
        if (setting.options) {
            setting.options.forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option.value;
                optionElement.textContent = option.label;
                if (option.icon) {
                    optionElement.setAttribute('data-icon', option.icon);
                }
                select.appendChild(optionElement);
            });
        }

        const currentValue = this.getSettingValue(setting.id);
        select.value = currentValue || '';
        select.addEventListener('change', async (e) => {
            await this.updateSetting(setting.id, e.target.value);
            // При изменении select нужно обновить видимость зависимых полей
            this.updateVisibility();
        });
        container.appendChild(select);
        return container;
    }

    createTextControl(setting) {
        const container = document.createElement('div');
        container.className = 'text-container';

        const input = document.createElement('input');
        input.type = setting.secure ? 'password' : 'text';
        input.id = `setting-${setting.id}`;
        input.dataset.setting = setting.id;
        input.className = 'setting-input';
        input.placeholder = setting.placeholder || '';
        input.autocomplete = 'off';

        const currentValue = this.getSettingValue(setting.id);
        input.value = currentValue || '';
        if (setting.secure) {
            const eyeButton = document.createElement('button');
            eyeButton.type = 'button';
            eyeButton.className = 'password-toggle';
            eyeButton.innerHTML = '<i class="fas fa-eye"></i>';
            eyeButton.addEventListener('click', () => {
                const isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';
                eyeButton.innerHTML = isPassword ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
            });
            container.appendChild(eyeButton);
        }

        input.addEventListener('input', (e) => {
            this.debounce(`text-${setting.id}`, async () => {
                await this.updateSetting(setting.id, e.target.value);
            }, 500);
        });
        container.appendChild(input);
        return container;
    }

    createApiKeyControl(setting) {
        const container = document.createElement('div');
        container.className = 'api-key-container';

        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'api-key-input-wrapper';

        const input = document.createElement('input');
        input.type = 'password';
        input.id = `setting-${setting.id}`;
        input.dataset.setting = setting.id;
        input.className = 'setting-input';
        input.placeholder = setting.placeholder || 'Введите API ключ';
        input.autocomplete = 'off';

        const currentValue = this.getSettingValue(setting.id);
        input.value = currentValue || '';

        const eyeButton = document.createElement('button');
        eyeButton.type = 'button';
        eyeButton.className = 'password-toggle';
        eyeButton.innerHTML = '<i class="fas fa-eye"></i>';
        eyeButton.addEventListener('click', () => {
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            eyeButton.innerHTML = isPassword ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
        });
        input.addEventListener('input', (e) => {
            this.debounce(`apiKey-${setting.id}`, async () => {
                await this.updateSetting(setting.id, e.target.value);
            }, 500);
        });
        const testButton = document.createElement('button');
        testButton.type = 'button';
        testButton.className = 'test-api-button';
        testButton.textContent = 'Проверить';
        testButton.addEventListener('click', () => {
            this.testConnection();
        });
        inputWrapper.appendChild(input);
        inputWrapper.appendChild(eyeButton);
        container.appendChild(inputWrapper);
        container.appendChild(testButton);

        return container;
    }

    createColorControl(setting) {
        const container = document.createElement('div');
        container.className = 'color-picker';
        const currentValue = this.getSettingValue(setting.id) || 'indigo';
        if (setting.options) {
            setting.options.forEach(option => {
                const colorBtn = document.createElement('button');
                colorBtn.type = 'button';
                colorBtn.className = 'color-option';
                colorBtn.dataset.value = option.value;
                colorBtn.title = option.label;
                colorBtn.style.backgroundColor = option.color;
                colorBtn.innerHTML = '<i class="fas fa-check"></i>';
                if (option.value === currentValue) {
                    colorBtn.classList.add('selected');
                }
                colorBtn.addEventListener('click', async () => {
                    await this.updateSetting(setting.id, option.value);
                    this.markSelectedColor(setting.id, option.value);
                    this.applyThemeColor(option.value);
                });
                container.appendChild(colorBtn);
            });
        }
        return container;
    }

    createListControl(setting) {
        const container = document.createElement('div');
        container.className = 'list-container';
        const list = document.createElement('div');
        list.className = 'settings-list-items';
        const currentValue = this.getSettingValue(setting.id) || [];
        if (Array.isArray(currentValue)) {
            currentValue.forEach((item, index) => {
                const listItem = this.createListItem(setting, item, index);
                list.appendChild(listItem);
            });
        }
        container.appendChild(list);
        if (setting.canAdd) {
            const addButton = document.createElement('button');
            addButton.type = 'button';
            addButton.className = 'add-list-item';
            addButton.innerHTML = '<i class="fas fa-plus"></i> Добавить';
            addButton.addEventListener('click', () => {
                this.addListItem(setting);
            });
            container.appendChild(addButton);
        }
        return container;
    }

    createListItem(setting, item, index) {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.dataset.itemId = item.id || `item-${index}`;
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'list-item-name';
        nameInput.value = item.name || '';
        nameInput.placeholder = 'Название действия';
        const keyInput = document.createElement('input');
        keyInput.type = 'text';
        keyInput.className = 'list-item-key';
        keyInput.value = item.key || '';
        keyInput.placeholder = 'Сочетание клавиш';
        nameInput.addEventListener('input', (e) => {
            this.debounce(`list-name-${setting.id}-${index}`, async () => {
                await this.updateListItem(setting.id, index, 'name', e.target.value);
            }, 300);
        });
        keyInput.addEventListener('input', (e) => {
            this.debounce(`list-key-${setting.id}-${index}`, async () => {
                await this.updateListItem(setting.id, index, 'key', e.target.value);
            }, 300);
        });
        div.appendChild(nameInput);
        div.appendChild(keyInput);
        if (setting.canDelete) {
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'delete-list-item';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.title = 'Удалить';
            deleteBtn.addEventListener('click', () => {
                this.deleteListItem(setting.id, index);
            });
            div.appendChild(deleteBtn);
        }
        return div;
    }

    createButtonControl(setting) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'setting-button';
        button.textContent = setting.text || 'Выполнить';
        button.dataset.action = setting.action;
        button.addEventListener('click', () => {
            this.handleButtonAction(setting);
        });
        return button;
    }

    addResetButton() {
        const container = document.createElement('div');
        container.className = 'reset-settings-container';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'reset-settings-button';
        button.innerHTML = '<i class="fas fa-undo"></i> Сбросить все настройки';
        button.addEventListener('click', async () => {
            await this.resetSettings();
        });
        container.appendChild(button);
        this.elements.settingsContent.appendChild(container);
    }

    getSettingValue(path) {
        const parts = path.split('.');
        let current = this.currentValues;
        for (const part of parts) {
            if (current && typeof current === 'object' && part in current) {
                current = current[part];
            } else {
                return undefined;
            }
        }
        return current;
    }

    async updateSetting(path, value) {
        try {
            if (!window.electronAPI) return;
            this.setSettingValue(path, value);
            await window.electronAPI.updateSetting(path, value);
            this.showSaveIndicator();

            // После обновления значения могут измениться условия видимости
            this.updateVisibility();

            console.log(`Setting updated: ${path} =`, value);
        } catch (error) {
            console.error(`Failed to update setting ${path}:`, error);
            this.showNotification('Ошибка сохранения настройки', 'error');
        }
    }

    setSettingValue(path, value) {
        const parts = path.split('.');
        let current = this.currentValues;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
                current[parts[i]] = {};
            }
            current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = value;
    }

    /**
     * Ключевая функция для управления видимостью полей
     */
    updateVisibility() {
        const allSettings = document.querySelectorAll('.setting-item[data-depends-on]');

        allSettings.forEach(item => {
            const dependsOn = item.dataset.dependsOn;
            const parentValue = this.getSettingValue(dependsOn);

            let shouldShow = true;

            // Логика showFor
            if (item.dataset.showFor) {
                try {
                    const showFor = JSON.parse(item.dataset.showFor);
                    shouldShow = showFor.includes(parentValue);
                } catch (e) {
                    console.error('Error parsing showFor', e);
                }
            }

            // Логика hideFor
            if (shouldShow && item.dataset.hideFor) {
                try {
                    const hideFor = JSON.parse(item.dataset.hideFor);
                    if (hideFor.includes(parentValue)) {
                        shouldShow = false;
                    }
                } catch (e) {
                    console.error('Error parsing hideFor', e);
                }
            }

            // Переключаем видимость
            // Используем inline style, так как это надежнее без доступа к CSS файлу
            item.style.display = shouldShow ? 'flex' : 'none';
        });
    }

    async updateListItem(listId, index, field, value) {
        const path = listId;
        const currentValue = this.getSettingValue(path) || [];
        if (currentValue[index]) {
            currentValue[index][field] = value;
            await this.updateSetting(path, currentValue);
        }
    }

    async addListItem(setting) {
        const path = setting.id;
        const currentValue = this.getSettingValue(path) || [];
        const newItem = {
            id: `item_${Date.now()}`,
            name: 'Новое действие',
            key: 'Ctrl+'
        };
        currentValue.push(newItem);
        await this.updateSetting(path, currentValue);
        await this.loadSettings();
    }

    async deleteListItem(settingId, index) {
        const currentValue = this.getSettingValue(settingId) || [];
        if (index >= 0 && index < currentValue.length) {
            currentValue.splice(index, 1);
            await this.updateSetting(settingId, currentValue);
            await this.loadSettings();
        }
    }

    markSelectedColor(settingId, colorValue) {
        const settingElement = document.querySelector(`[data-setting-id="${settingId}"]`);
        if (!settingElement) return;
        const colorOptions = settingElement.querySelectorAll('.color-option');
        colorOptions.forEach(btn => {
            btn.classList.remove('selected');
            if (btn.dataset.value === colorValue) {
                btn.classList.add('selected');
            }
        });
    }

    async handleButtonAction(setting) {
        switch (setting.action) {
            case 'testConnection':
                await this.testConnection();
                break;
            default:
                console.warn(`Unknown action: ${setting.action}`);
        }
    }

    async testConnection() {
        const apiKey = this.getSettingValue('provider.apiKey');
        const provider = this.getSettingValue('provider.name');

        // Получаем специфичный конфиг для провайдера
        let config = {};
        if (provider) {
            const providerConfigPath = `provider.config.${provider}`;
            const providerConfig = this.getSettingValue(providerConfigPath);
            // Нам нужно "плоское" состояние настроек для теста, но getSettingValue возвращает объект.
            // Здесь нам нужно собрать конфиг, который ожидает фабрика.
            // В SettingsManager.js уже есть логика, которая сохраняет это в SettingsStore.
            // Но для теста мы можем передать текущие значения из UI.
            config = providerConfig || {};

            // Дополнительно соберем значения из инпутов, если они еще не сохранены (опционально)
            // Но лучше полагаться на сохраненные значения, так как updateSetting вызывается сразу.
        }

        if (!apiKey && provider !== 'mock') {
            this.showNotification('Введите API ключ для проверки', 'error');
            return;
        }

        this.showLoading(true);
        try {
            if (window.electronAPI) {
                // Передаем также конфиг
                const result = await window.electronAPI.testProviderConnection(provider, apiKey, config);
                if (result.success) {
                    this.showNotification(result.message || 'Соединение успешно установлено!', 'success');
                } else {
                    this.showNotification(result.error || 'Ошибка соединения', 'error');
                }
            }
        } catch (error) {
            this.showNotification('Ошибка при проверке соединения', 'error');
            console.error('Connection test failed:', error);
        } finally {
            this.showLoading(false);
        }
    }

    applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }
        const themeToggle = document.querySelector(`[data-setting-id="customization.theme"] input`);
        if (themeToggle) {
            themeToggle.checked = theme === 'dark';
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
        if (colors.secondary) {
            document.documentElement.style.setProperty('--secondary', colors.secondary);
        }
        this.markSelectedColor('customization.themeColor', color);
    }

    showLoading(show) {
        let overlay = document.querySelector('.loading-overlay');
        if (show) {
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'loading-overlay';
                const spinner = document.createElement('div');
                spinner.className = 'loading-spinner';
                overlay.appendChild(spinner);
                document.body.appendChild(overlay);
            }
            overlay.classList.add('active');
        } else if (overlay) {
            overlay.classList.remove('active');
        }
    }

    showSaveIndicator() {
        let indicator = document.querySelector('.save-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'save-indicator';
            indicator.innerHTML = '<i class="fas fa-check"></i> Настройки сохранены';
            document.body.appendChild(indicator);
        }
        indicator.classList.add('show');
        setTimeout(() => {
            indicator.classList.remove('show');
        }, 1500);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    debounce(key, callback, delay) {
        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key));
        }
        const timer = setTimeout(() => {
            callback();
            this.debounceTimers.delete(key);
        }, delay);
        this.debounceTimers.set(key, timer);
    }

    toggleSettings() {
        if (this.isSettingsOpen) {
            this.hideSettings();
        } else {
            this.showSettings();
        }
    }

    async showSettings() {
        if (this.isSettingsOpen) return;
        this.elements.settingsPanel.classList.add('visible');
        this.elements.settingsToggle.classList.add('active');
        this.isSettingsOpen = true;
        await this.loadSettings();
        this.elements.settingsPanel.focus();
    }

    hideSettings() {
        if (!this.isSettingsOpen) return;
        this.elements.settingsPanel.classList.remove('visible');
        this.elements.settingsToggle.classList.remove('active');
        this.isSettingsOpen = false;
        if (window.translatorRenderer) {
            window.translatorRenderer.updateSettingsState(false);
        }
    }

    async resetSettings() {
        if (!confirm('Вы уверены, что хотите сбросить все настройки к значениям по умолчанию?')) {
            return;
        }
        try {
            this.showLoading(true);
            if (window.electronAPI) {
                await window.electronAPI.resetSettings();
                this.showNotification('Настройки сброшены', 'success');
                await this.loadSettings();
                const defaultTheme = this.getSettingValue('customization.theme');
                const defaultColor = this.getSettingValue('customization.themeColor');
                this.applyTheme(defaultTheme);
                this.applyThemeColor(defaultColor);
            }
        } catch (error) {
            console.error('Failed to reset settings:', error);
            this.showNotification('Ошибка сброса настроек', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    updateValues(newValues) {
        this.currentValues = newValues;
        this.applyCurrentValues();
    }

    applyCurrentValues() {
        document.querySelectorAll('.toggle-switch input[data-setting]').forEach(input => {
            const settingId = input.dataset.setting;
            const currentValue = this.getSettingValue(settingId);
            if (currentValue !== undefined) {
                if (settingId === 'customization.theme') {
                    input.checked = currentValue === 'dark';
                } else {
                    input.checked = Boolean(currentValue);
                }
            }
        });
        document.querySelectorAll('.setting-select[data-setting]').forEach(select => {
            const settingId = select.dataset.setting;
            const currentValue = this.getSettingValue(settingId);
            if (currentValue !== undefined) {
                select.value = currentValue;
            }
        });
        document.querySelectorAll('.setting-input[data-setting]').forEach(input => {
            const settingId = input.dataset.setting;
            const currentValue = this.getSettingValue(settingId);
            if (currentValue !== undefined) {
                input.value = currentValue;
            }
        });
        document.querySelectorAll('.color-picker').forEach(picker => {
            const settingId = picker.closest('.setting-item')?.dataset.settingId;
            if (!settingId) return;
            const currentValue = this.getSettingValue(settingId);
            this.markSelectedColor(settingId, currentValue);
        });
        // Также обновляем видимость
        this.updateVisibility();
    }

    cleanup() {
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
        this.isSettingsOpen = false;
    }
}

    const settingsRenderer = new SettingsRenderer();
window.settingsRenderer = settingsRenderer;
document.addEventListener('DOMContentLoaded', () => {
    settingsRenderer.initialize().catch(console.error);
});
if (typeof module !== 'undefined' && module.exports) {
    module.exports = settingsRenderer;
}