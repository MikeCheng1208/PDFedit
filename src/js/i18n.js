/**
 * i18n - Internationalization Module
 * Handles language switching between zh-TW and en
 */

class I18n {
  constructor() {
    this.currentLang = localStorage.getItem('pdfedit-lang') || 'zh-TW';
    this.translations = {};
    this.loaded = false;
  }

  async init() {
    await this.loadTranslations(this.currentLang);
    this.updateUI();
    this.loaded = true;
  }

  async loadTranslations(lang) {
    try {
      // 優先使用 Electron IPC
      if (window.electronAPI?.loadTranslations) {
        const data = await window.electronAPI.loadTranslations(lang);
        if (data) {
          this.translations = data;
          return;
        }
      }
      // Fallback: 使用 fetch
      const response = await fetch(`locales/${lang}.json`);
      this.translations = await response.json();
    } catch (error) {
      console.error('Failed to load translations:', error);
      // Fallback to zh-TW if loading fails
      if (lang !== 'zh-TW') {
        await this.loadTranslations('zh-TW');
      }
    }
  }

  async setLanguage(lang) {
    if (lang === this.currentLang) return;

    this.currentLang = lang;
    localStorage.setItem('pdfedit-lang', lang);
    await this.loadTranslations(lang);
    this.updateUI();

    // Update language button label
    const langBtn = document.getElementById('btn-lang');
    if (langBtn) {
      langBtn.querySelector('.lang-label').textContent = lang === 'zh-TW' ? '中' : 'EN';
    }
  }

  toggleLanguage() {
    const newLang = this.currentLang === 'zh-TW' ? 'en' : 'zh-TW';
    return this.setLanguage(newLang);
  }

  t(key, params = {}) {
    let text = this.translations[key] || key;

    // Replace placeholders like {current} with actual values
    Object.keys(params).forEach(param => {
      text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), params[param]);
    });

    return text;
  }

  updateUI() {
    // Update elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = this.t(key);
    });

    // Update elements with data-i18n-title attribute
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      el.title = this.t(key);
    });

    // Update elements with data-i18n-placeholder attribute
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.placeholder = this.t(key);
    });

    // Update document language
    document.documentElement.lang = this.currentLang === 'zh-TW' ? 'zh-TW' : 'en';

    // Dispatch event for other modules
    window.dispatchEvent(new CustomEvent('languageChanged', {
      detail: { lang: this.currentLang }
    }));
  }

  getCurrentLang() {
    return this.currentLang;
  }
}

// Create global instance
window.i18n = new I18n();
