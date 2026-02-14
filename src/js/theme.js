/**
 * Theme Manager
 * Handles light/dark theme switching with system preference detection
 */

class ThemeManager {
  constructor() {
    this.theme = localStorage.getItem('pdfedit-theme') || 'system';
    this.actualTheme = 'light';
  }

  async init() {
    // Get system theme from Electron
    if (window.electronAPI) {
      const systemTheme = await window.electronAPI.getSystemTheme();
      this.updateActualTheme(systemTheme);

      // Listen for system theme changes
      window.electronAPI.onSystemThemeChanged((theme) => {
        if (this.theme === 'system') {
          this.updateActualTheme(theme);
        }
      });
    } else {
      // Fallback for browser testing
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.updateActualTheme(prefersDark ? 'dark' : 'light');
    }

    this.applyTheme();
  }

  updateActualTheme(systemTheme) {
    if (this.theme === 'system') {
      this.actualTheme = systemTheme;
    } else {
      this.actualTheme = this.theme;
    }
  }

  applyTheme() {
    document.documentElement.setAttribute('data-theme', this.actualTheme);

    // Dispatch event for other modules
    window.dispatchEvent(new CustomEvent('themeChanged', {
      detail: { theme: this.actualTheme }
    }));
  }

  setTheme(theme) {
    this.theme = theme;
    localStorage.setItem('pdfedit-theme', theme);

    if (theme === 'system') {
      window.electronAPI?.getSystemTheme().then(systemTheme => {
        this.actualTheme = systemTheme;
        this.applyTheme();
      });
    } else {
      this.actualTheme = theme;
      this.applyTheme();
    }
  }

  toggleTheme() {
    // Cycle through: light -> dark -> system -> light
    const themes = ['light', 'dark'];
    const currentIndex = themes.indexOf(this.actualTheme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    this.setTheme(nextTheme);
    return nextTheme;
  }

  getTheme() {
    return this.theme;
  }

  getActualTheme() {
    return this.actualTheme;
  }

  isDark() {
    return this.actualTheme === 'dark';
  }
}

// Create global instance
window.themeManager = new ThemeManager();
