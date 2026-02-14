/**
 * Tab Manager Module
 * Manages multiple PDF file tabs, coordinates state saving/restoring across modules
 */

class TabManager {
  constructor() {
    /** @type {Map<string, Object>} */
    this.tabs = new Map();

    /** @type {string|null} */
    this.activeTabId = null;

    /** @type {HTMLElement|null} */
    this.tabBar = null;

    /** @type {HTMLElement|null} */
    this.tabList = null;
  }

  init() {
    this.tabBar = document.getElementById('tab-bar');
    this.tabList = document.getElementById('tab-list');
    this.setupEvents();
  }

  setupEvents() {
    // Event delegation on tab list
    this.tabList.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('.tab-close');
      const tabEl = e.target.closest('.tab-item');

      if (closeBtn) {
        e.stopPropagation();
        const tabId = closeBtn.closest('.tab-item').dataset.tabId;
        this.closeTab(tabId);
        return;
      }

      if (tabEl) {
        this.switchTab(tabEl.dataset.tabId);
      }
    });

    // Middle-click to close tab
    this.tabList.addEventListener('mousedown', (e) => {
      if (e.button === 1) {
        const tabEl = e.target.closest('.tab-item');
        if (tabEl) {
          e.preventDefault();
          this.closeTab(tabEl.dataset.tabId);
        }
      }
    });
  }

  // ─── Core Operations ──────────────────────────────

  /**
   * Create a new tab and set it as active
   * @returns {string} New tab ID
   */
  createTab(fileName, filePath, pdfJsDoc, pdfLibDoc, originalBuffer) {
    const id = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    const tabState = {
      id,
      fileName,
      filePath,
      modified: false,
      // PDFRenderer state
      pdfJsDoc,
      currentPage: 1,
      totalPages: pdfJsDoc.numPages,
      scale: 1.0,
      pageRotations: {},
      // PDFEditor state
      pdfLibDoc,
      originalBuffer,
      // CanvasLayer state
      pageAnnotations: {},
      // Scroll position
      scrollTop: 0,
      scrollLeft: 0
    };

    this.tabs.set(id, tabState);
    this._renderTabElement(tabState);
    this._showTabBar();

    return id;
  }

  /**
   * Switch to a specific tab
   */
  async switchTab(tabId) {
    if (tabId === this.activeTabId) return;

    const targetTab = this.tabs.get(tabId);
    if (!targetTab) return;

    // Save current tab state
    if (this.activeTabId) {
      this._saveCurrentState();
    }

    // Restore target tab state
    this.activeTabId = tabId;
    await this._restoreState(targetTab);

    // Update tab bar UI
    this._updateActiveTab();
  }

  /**
   * Close a specific tab
   */
  async closeTab(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    // Check for unsaved changes
    if (tab.modified) {
      const action = await this._showUnsavedDialog(tab.fileName);
      if (action === 'cancel') return;
      if (action === 'save') {
        if (tabId !== this.activeTabId) {
          await this.switchTab(tabId);
        }
        await window.app.saveFile();
      }
    }

    // Destroy PDF.js document to free memory
    if (tab.pdfJsDoc) {
      tab.pdfJsDoc.destroy();
    }

    this.tabs.delete(tabId);
    this._removeTabElement(tabId);

    if (tabId === this.activeTabId) {
      this.activeTabId = null;

      if (this.tabs.size > 0) {
        const lastTabId = Array.from(this.tabs.keys()).pop();
        await this.switchTab(lastTabId);
      } else {
        this._showWelcomeState();
      }
    }

    if (this.tabs.size === 0) {
      this._hideTabBar();
    }
  }

  // ─── State Queries ────────────────────────────────

  getActiveTab() {
    return this.activeTabId ? this.tabs.get(this.activeTabId) : null;
  }

  getActiveTabId() {
    return this.activeTabId;
  }

  getTabCount() {
    return this.tabs.size;
  }

  findTabByPath(filePath) {
    if (!filePath) return null;
    for (const tab of this.tabs.values()) {
      if (tab.filePath === filePath) return tab;
    }
    return null;
  }

  markModified() {
    if (!this.activeTabId) return;
    const tab = this.tabs.get(this.activeTabId);
    if (tab && !tab.modified) {
      tab.modified = true;
      this._updateTabLabel(this.activeTabId);
    }
  }

  markSaved() {
    if (!this.activeTabId) return;
    const tab = this.tabs.get(this.activeTabId);
    if (tab) {
      tab.modified = false;
      this._updateTabLabel(this.activeTabId);
    }
  }

  updateFilePath(filePath) {
    if (!this.activeTabId) return;
    const tab = this.tabs.get(this.activeTabId);
    if (tab) {
      tab.filePath = filePath;
      const parts = filePath.split(/[/\\]/);
      tab.fileName = parts[parts.length - 1];
      this._updateTabLabel(this.activeTabId);
    }
  }

  /**
   * Check all tabs for unsaved changes before app close
   * @returns {Promise<boolean>} true if safe to close
   */
  async confirmCloseAll() {
    for (const [tabId, tab] of this.tabs) {
      if (tab.modified) {
        await this.switchTab(tabId);
        const action = await this._showUnsavedDialog(tab.fileName);
        if (action === 'cancel') return false;
        if (action === 'save') {
          await window.app.saveFile();
        }
      }
    }
    return true;
  }

  // ─── State Save/Restore (Private) ─────────────────

  _saveCurrentState() {
    const tab = this.tabs.get(this.activeTabId);
    if (!tab) return;

    // Save current page annotations first
    window.canvasLayer.savePageAnnotations(window.pageManager.getCurrentPage());

    // PDFRenderer state
    tab.pdfJsDoc = window.pdfRenderer.pdfDoc;
    tab.currentPage = window.pdfRenderer.currentPage;
    tab.totalPages = window.pdfRenderer.totalPages;
    tab.scale = window.pdfRenderer.scale;
    tab.pageRotations = { ...window.pdfRenderer.pageRotations };

    // PDFEditor state
    tab.pdfLibDoc = window.pdfEditor.pdfDoc;
    tab.originalBuffer = window.pdfEditor.originalBuffer;
    tab.filePath = window.pdfEditor.currentFilePath;
    tab.modified = window.pdfEditor.modified;

    // CanvasLayer state
    tab.pageAnnotations = { ...window.canvasLayer.pageAnnotations };

    // Scroll position
    const viewer = document.getElementById('viewer-container');
    tab.scrollTop = viewer.scrollTop;
    tab.scrollLeft = viewer.scrollLeft;
  }

  async _restoreState(tab) {
    // PDFRenderer — swap document reference
    window.pdfRenderer.pdfDoc = tab.pdfJsDoc;
    window.pdfRenderer.currentPage = tab.currentPage;
    window.pdfRenderer.totalPages = tab.totalPages;
    window.pdfRenderer.scale = tab.scale;
    window.pdfRenderer.pageRotations = { ...tab.pageRotations };

    // PDFEditor — swap document reference
    window.pdfEditor.pdfDoc = tab.pdfLibDoc;
    window.pdfEditor.originalBuffer = tab.originalBuffer;
    window.pdfEditor.currentFilePath = tab.filePath;
    window.pdfEditor.modified = tab.modified;

    // CanvasLayer
    window.canvasLayer.setAllAnnotations({ ...tab.pageAnnotations });

    // App
    window.app.currentFilePath = tab.filePath;

    // Re-render current page
    await window.pdfRenderer.renderPage(tab.currentPage);

    // Load annotations for this page
    window.canvasLayer.loadPageAnnotations(tab.currentPage);

    // Re-render thumbnails
    await window.pageManager.renderThumbnails();

    // Restore scroll position
    const viewer = document.getElementById('viewer-container');
    viewer.scrollTop = tab.scrollTop;
    viewer.scrollLeft = tab.scrollLeft;

    // Update UI
    window.uiController.hideWelcome();
    window.uiController.enableToolbar();
  }

  _showWelcomeState() {
    window.pdfRenderer.destroy();
    window.pdfEditor.pdfDoc = null;
    window.pdfEditor.originalBuffer = null;
    window.pdfEditor.currentFilePath = null;
    window.pdfEditor.modified = false;
    window.canvasLayer.setAllAnnotations({});
    window.canvasLayer.getCanvas()?.clear();
    window.app.currentFilePath = null;

    window.uiController.showWelcome();
    window.uiController.disableToolbar();

    const container = document.getElementById('thumbnail-container');
    if (container) container.innerHTML = '';

    document.getElementById('current-page').textContent = '1';
    document.getElementById('total-pages').textContent = '1';
  }

  // ─── Unsaved Dialog ───────────────────────────────

  _showUnsavedDialog(fileName) {
    return new Promise((resolve) => {
      const modal = document.getElementById('unsaved-modal');
      const fileNameEl = document.getElementById('unsaved-file-name');
      fileNameEl.textContent = fileName;
      modal.style.display = 'flex';

      const handleAction = (action) => {
        modal.style.display = 'none';
        cleanup();
        resolve(action);
      };

      const onSave = () => handleAction('save');
      const onDiscard = () => handleAction('discard');
      const onCancel = () => handleAction('cancel');
      const onBackdrop = (e) => { if (e.target === modal) onCancel(); };
      const onKeydown = (e) => { if (e.key === 'Escape') onCancel(); };

      const btnSave = document.getElementById('btn-unsaved-save');
      const btnDiscard = document.getElementById('btn-unsaved-discard');
      const btnCancel = document.getElementById('btn-unsaved-cancel');
      const btnCloseX = document.getElementById('btn-unsaved-cancel-x');

      btnSave.addEventListener('click', onSave);
      btnDiscard.addEventListener('click', onDiscard);
      btnCancel.addEventListener('click', onCancel);
      btnCloseX.addEventListener('click', onCancel);
      modal.addEventListener('click', onBackdrop);
      document.addEventListener('keydown', onKeydown);

      function cleanup() {
        btnSave.removeEventListener('click', onSave);
        btnDiscard.removeEventListener('click', onDiscard);
        btnCancel.removeEventListener('click', onCancel);
        btnCloseX.removeEventListener('click', onCancel);
        modal.removeEventListener('click', onBackdrop);
        document.removeEventListener('keydown', onKeydown);
      }
    });
  }

  // ─── DOM Operations (Private) ─────────────────────

  _renderTabElement(tabState) {
    const tabEl = document.createElement('div');
    tabEl.className = 'tab-item';
    tabEl.dataset.tabId = tabState.id;

    const label = document.createElement('span');
    label.className = 'tab-label';
    label.title = tabState.fileName;
    label.textContent = tabState.fileName;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close';
    closeBtn.setAttribute('aria-label', 'Close tab');
    closeBtn.innerHTML = '&times;';

    tabEl.appendChild(label);
    tabEl.appendChild(closeBtn);
    this.tabList.appendChild(tabEl);

    // Scroll new tab into view
    tabEl.scrollIntoView({ behavior: 'smooth', inline: 'end' });
  }

  _removeTabElement(tabId) {
    const el = this.tabList.querySelector(`[data-tab-id="${tabId}"]`);
    if (el) el.remove();
  }

  _updateActiveTab() {
    this.tabList.querySelectorAll('.tab-item').forEach(el => {
      el.classList.toggle('active', el.dataset.tabId === this.activeTabId);
    });
  }

  _updateTabLabel(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    const el = this.tabList.querySelector(`[data-tab-id="${tabId}"]`);
    if (!el) return;

    const label = el.querySelector('.tab-label');
    label.textContent = tab.modified ? `${tab.fileName} *` : tab.fileName;
    label.title = tab.fileName;
  }

  _showTabBar() {
    if (this.tabBar) {
      this.tabBar.style.display = 'flex';
    }
  }

  _hideTabBar() {
    if (this.tabBar) {
      this.tabBar.style.display = 'none';
    }
  }
}

// Create global instance
window.tabManager = new TabManager();
