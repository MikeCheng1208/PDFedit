/**
 * PDFedit - Main Application
 * Initializes and coordinates all modules
 */

class App {
  constructor() {
    this.currentFilePath = null;
  }

  async init() {
    // Initialize modules
    await window.i18n.init();
    await window.themeManager.init();

    // Initialize UI
    window.uiController.init();
    window.pageManager.init();
    window.signatureManager.init();
    window.tabManager.init();

    // Setup PDF canvas
    const pdfCanvas = document.getElementById('pdf-canvas');
    window.pdfRenderer.setCanvas(pdfCanvas);

    // Initialize fabric canvas
    window.canvasLayer.init('fabric-container');

    // Setup event listeners
    this.setupEventListeners();
    this.setupDragAndDrop();
    this.setupPinchZoom();
    this.setupKeyboardShortcuts();

    // Update language button
    const langBtn = document.getElementById('btn-lang');
    langBtn.querySelector('.lang-label').textContent = window.i18n.getCurrentLang() === 'zh-TW' ? '中' : 'EN';

    // Listen for menu Select All
    window.electronAPI?.onMenuSelectAll(() => this.handleSelectAll());

    // Listen for app close
    window.electronAPI?.onBeforeClose(async () => {
      const canClose = await window.tabManager.confirmCloseAll();
      if (canClose) {
        window.electronAPI.confirmClose();
      }
    });

    console.log('PDFedit initialized');
  }

  setupEventListeners() {
    // Open file buttons
    document.getElementById('btn-open')?.addEventListener('click', () => this.openFile());
    document.getElementById('btn-open-welcome')?.addEventListener('click', () => this.openFile());

    // Save button
    document.getElementById('btn-save')?.addEventListener('click', () => this.saveFile());

    // Theme toggle
    document.getElementById('btn-theme')?.addEventListener('click', () => {
      window.themeManager.toggleTheme();
    });

    // Language toggle
    document.getElementById('btn-lang')?.addEventListener('click', async () => {
      await window.i18n.toggleLanguage();
      const langBtn = document.getElementById('btn-lang');
      langBtn.querySelector('.lang-label').textContent = window.i18n.getCurrentLang() === 'zh-TW' ? '中' : 'EN';
    });

    // Navigation buttons
    document.getElementById('btn-prev-page')?.addEventListener('click', () => {
      window.pageManager.prevPage();
    });
    document.getElementById('btn-next-page')?.addEventListener('click', () => {
      window.pageManager.nextPage();
    });

    // Zoom controls
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => this.zoomIn());
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => this.zoomOut());
    document.getElementById('btn-zoom-fit')?.addEventListener('click', () => this.fitWidth());

    // Page management
    document.getElementById('btn-rotate-cw')?.addEventListener('click', () => this.rotatePage(90));
    document.getElementById('btn-rotate-ccw')?.addEventListener('click', () => this.rotatePage(-90));
    document.getElementById('btn-delete-page')?.addEventListener('click', () => this.deletePage());
    document.getElementById('btn-duplicate-page')?.addEventListener('click', () => this.duplicatePage());
    document.getElementById('btn-insert-blank')?.addEventListener('click', () => this.insertBlankPage());
    document.getElementById('btn-merge-pdf')?.addEventListener('click', () => this.mergePDF());
    document.getElementById('btn-split-pdf')?.addEventListener('click', () => window.uiController.showSplitModal());

    // Menu events from Electron
    window.electronAPI?.onMenuOpenFile(() => this.openFile());
    window.electronAPI?.onMenuSaveFile(() => this.saveFile());
    window.electronAPI?.onMenuSaveFileAs(() => this.saveFileAs());

    // Page rendered event
    window.addEventListener('pageRendered', (e) => {
      window.uiController.updateZoomLevel(e.detail.scale);
    });
  }

  setupDragAndDrop() {
    const viewerContainer = document.getElementById('viewer-container');

    viewerContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      viewerContainer.classList.add('drag-over');
    });

    viewerContainer.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      viewerContainer.classList.remove('drag-over');
    });

    viewerContainer.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      viewerContainer.classList.remove('drag-over');

      const files = Array.from(e.dataTransfer.files);
      const pdfFiles = files.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));

      for (const pdfFile of pdfFiles) {
        const arrayBuffer = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target.result);
          reader.onerror = reject;
          reader.readAsArrayBuffer(pdfFile);
        });
        await this.loadPDF(arrayBuffer, pdfFile.name);
      }
    });
  }

  setupPinchZoom() {
    const viewerContainer = document.getElementById('viewer-container');
    let pendingZoom = null;

    viewerContainer.addEventListener('wheel', (e) => {
      // macOS trackpad pinch-to-zoom fires as ctrlKey + wheel
      if (!e.ctrlKey) return;

      e.preventDefault();

      if (!window.pdfRenderer.isLoaded()) return;

      // Calculate new scale from delta
      const zoomFactor = 1 - e.deltaY * 0.01;
      const newScale = window.pdfRenderer.scale * zoomFactor;

      // Debounce rendering — update scale immediately, render once settled
      window.pdfRenderer.scale = Math.max(0.25, Math.min(4, newScale));
      window.uiController.updateZoomLevel(window.pdfRenderer.scale);

      if (pendingZoom) cancelAnimationFrame(pendingZoom);
      pendingZoom = requestAnimationFrame(() => {
        pendingZoom = null;
        window.pdfRenderer.renderPage();
      });
    }, { passive: false });
  }

  _isTextEditing() {
    const active = window.canvasLayer.getCanvas()?.getActiveObject();
    return active && active.isEditing;
  }

  handleSelectAll() {
    if (this._isTextEditing()) {
      const active = window.canvasLayer.getCanvas().getActiveObject();
      active.selectAll();
      active.canvas.requestRenderAll();
    } else {
      document.execCommand('selectAll');
    }
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + O: Open
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        this.openFile();
      }

      // Ctrl/Cmd + S: Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          this.saveFileAs();
        } else {
          this.saveFile();
        }
      }

      // Ctrl/Cmd + W: Close current tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        const activeTabId = window.tabManager.getActiveTabId();
        if (activeTabId) {
          window.tabManager.closeTab(activeTabId);
        }
      }

      // Page navigation (skip when editing text)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !this._isTextEditing()) {
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          window.pageManager.prevPage();
        } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
          window.pageManager.nextPage();
        }
      }

      // Zoom
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        this.zoomIn();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        this.zoomOut();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        this.fitWidth();
      }

      // Delete selected object (skip when editing text)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!this._isTextEditing() &&
            document.activeElement.tagName !== 'INPUT' &&
            document.activeElement.tagName !== 'TEXTAREA') {
          window.canvasLayer.deleteSelected();
        }
      }

      // Escape: exit text editing, deselect, close modals
      if (e.key === 'Escape') {
        if (this._isTextEditing()) {
          const active = window.canvasLayer.getCanvas().getActiveObject();
          active.exitEditing();
          window.canvasLayer.getCanvas().renderAll();
        } else {
          window.canvasLayer.getCanvas()?.discardActiveObject();
          window.canvasLayer.getCanvas()?.renderAll();
        }
        window.signatureManager.close();
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
      }
    });
  }

  async openFile() {
    try {
      const result = await window.electronAPI.openFile();
      if (!result) return;

      // Check if this file is already open
      const existingTab = window.tabManager.findTabByPath(result.path);
      if (existingTab) {
        await window.tabManager.switchTab(existingTab.id);
        this.showToast(window.i18n.t('fileAlreadyOpen'), 'info');
        return;
      }

      await this.loadPDF(result.buffer, result.name, result.path);
    } catch (error) {
      console.error('[App] Failed to open file:', error);
      this.showToast(window.i18n.t('errorOpenFile'), 'error');
    }
  }

  async loadPDF(arrayBuffer, fileName, filePath = null) {
    window.uiController.showLoading();

    try {
      // Copy buffer because PDF.js transfers the ArrayBuffer to its worker,
      // which detaches the original and makes it unusable for pdf-lib
      const bufferForEditor = arrayBuffer instanceof ArrayBuffer
        ? arrayBuffer.slice(0)
        : arrayBuffer.slice(0).buffer;

      // Load PDF.js document
      const pdfjsLib = window.pdfjsLib;
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdfJsDoc = await loadingTask.promise;

      // Load pdf-lib document
      const { PDFDocument } = PDFLib;
      const pdfLibDoc = await PDFDocument.load(bufferForEditor);
      const originalBuffer = bufferForEditor instanceof ArrayBuffer
        ? bufferForEditor.slice(0)
        : bufferForEditor;

      // Save current tab state before creating new one
      if (window.tabManager.getActiveTabId()) {
        window.tabManager._saveCurrentState();
      }

      // Create new tab
      const tabId = window.tabManager.createTab(
        fileName, filePath, pdfJsDoc, pdfLibDoc, originalBuffer
      );

      // Set document references into modules
      window.pdfRenderer.pdfDoc = pdfJsDoc;
      window.pdfRenderer.currentPage = 1;
      window.pdfRenderer.totalPages = pdfJsDoc.numPages;
      window.pdfRenderer.scale = 1.0;
      window.pdfRenderer.pageRotations = {};

      window.pdfEditor.pdfDoc = pdfLibDoc;
      window.pdfEditor.originalBuffer = originalBuffer;
      window.pdfEditor.currentFilePath = filePath;
      window.pdfEditor.modified = false;

      window.canvasLayer.setAllAnnotations({});

      // Activate the new tab
      window.tabManager.activeTabId = tabId;
      window.tabManager._updateActiveTab();

      // Render
      await window.pdfRenderer.renderPage(1);
      await window.pageManager.renderThumbnails();
      window.canvasLayer.loadPageAnnotations(1);

      // Update UI
      window.uiController.hideWelcome();
      window.uiController.enableToolbar();

      this.currentFilePath = filePath;
      await this.fitWidth();

      this.showToast(window.i18n.t('fileOpened'), 'success');

    } catch (error) {
      console.error('Failed to load PDF:', error);
      this.showToast(window.i18n.t('errorLoadPDF'), 'error');
    } finally {
      window.uiController.hideLoading();
    }
  }

  async saveFile() {
    if (!window.pdfRenderer.isLoaded()) return;

    const tab = window.tabManager.getActiveTab();
    if (!tab) return;

    if (tab.filePath) {
      await this.saveToPath(tab.filePath);
    } else {
      await this.saveFileAs();
    }
  }

  async saveFileAs() {
    if (!window.pdfRenderer.isLoaded()) return;

    window.uiController.showLoading();

    try {
      // Save current page annotations
      window.canvasLayer.savePageAnnotations(window.pageManager.getCurrentPage());

      const pdfBytes = await window.pdfEditor.save();

      const result = await window.electronAPI.saveFile({
        buffer: pdfBytes,
        defaultPath: this.currentFilePath || 'document.pdf'
      });

      if (result) {
        this.currentFilePath = result;
        window.pdfEditor.setFilePath(result);
        window.tabManager.updateFilePath(result);
        window.tabManager.markSaved();
        this.showToast(window.i18n.t('fileSaved'), 'success');
      }
    } catch (error) {
      console.error('Failed to save file:', error);
      this.showToast(window.i18n.t('errorSaveFile'), 'error');
    } finally {
      window.uiController.hideLoading();
    }
  }

  async saveToPath(filePath) {
    window.uiController.showLoading();

    try {
      // Save current page annotations
      window.canvasLayer.savePageAnnotations(window.pageManager.getCurrentPage());

      const pdfBytes = await window.pdfEditor.save();

      const result = await window.electronAPI.saveFileDirect({
        buffer: pdfBytes,
        filePath: filePath
      });

      if (result.success) {
        window.tabManager.markSaved();
        this.showToast(window.i18n.t('fileSaved'), 'success');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Failed to save file:', error);
      this.showToast(window.i18n.t('errorSaveFile'), 'error');
    } finally {
      window.uiController.hideLoading();
    }
  }

  async zoomIn() {
    await window.pdfRenderer.zoomIn();
  }

  async zoomOut() {
    await window.pdfRenderer.zoomOut();
  }

  async fitWidth() {
    const container = document.getElementById('viewer-container');
    await window.pdfRenderer.fitWidth(container.clientWidth);
  }

  async rotatePage(degrees) {
    await window.pdfEditor.rotatePage(window.pageManager.getCurrentPage(), degrees);
    await window.pageManager.rotatePage(degrees);
  }

  async deletePage() {
    const currentPage = window.pageManager.getCurrentPage();
    const totalPages = window.pageManager.getTotalPages();

    if (totalPages <= 1) {
      this.showToast(window.i18n.t('errorMinPages'), 'error');
      return;
    }

    const success = await window.pdfEditor.deletePage(currentPage);
    if (success) {
      // Reload PDF
      const pdfBytes = await window.pdfEditor.save();
      await this.reloadPDF(pdfBytes);
      this.showToast(window.i18n.t('pageDeleted'), 'success');
    }
  }

  async duplicatePage() {
    const currentPage = window.pageManager.getCurrentPage();
    const success = await window.pdfEditor.duplicatePage(currentPage);

    if (success) {
      const pdfBytes = await window.pdfEditor.save();
      await this.reloadPDF(pdfBytes);
      this.showToast(window.i18n.t('pageDuplicated'), 'success');
    }
  }

  async insertBlankPage() {
    const currentPage = window.pageManager.getCurrentPage();
    const success = await window.pdfEditor.insertBlankPage(currentPage);

    if (success) {
      const pdfBytes = await window.pdfEditor.save();
      await this.reloadPDF(pdfBytes);
      this.showToast(window.i18n.t('blankPageInserted'), 'success');
    }
  }

  async movePage(fromPageNum, toPageNum) {
    if (fromPageNum === toPageNum) return;

    // Save current page annotations before move
    window.canvasLayer.savePageAnnotations(window.pageManager.getCurrentPage());

    // Remap annotations
    const oldAnnotations = window.canvasLayer.getAllAnnotations();
    const newAnnotations = {};
    const totalPages = window.pageManager.getTotalPages();

    // Build the new order mapping: newPageNum -> oldPageNum
    const order = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i !== fromPageNum) order.push(i);
    }
    // Insert at the right position (toPageNum is 1-based in the new order)
    order.splice(toPageNum - 1, 0, fromPageNum);

    for (let newIdx = 0; newIdx < order.length; newIdx++) {
      const oldPage = order[newIdx];
      const newPage = newIdx + 1;
      if (oldAnnotations[oldPage]) {
        newAnnotations[newPage] = oldAnnotations[oldPage];
      }
    }
    window.canvasLayer.setAllAnnotations(newAnnotations);

    // Remap page rotations
    const oldRotations = { ...window.pdfRenderer.pageRotations };
    const newRotations = {};
    for (let newIdx = 0; newIdx < order.length; newIdx++) {
      const oldPage = order[newIdx];
      const newPage = newIdx + 1;
      if (oldRotations[oldPage]) {
        newRotations[newPage] = oldRotations[oldPage];
      }
    }
    window.pdfRenderer.pageRotations = newRotations;

    const success = await window.pdfEditor.movePage(fromPageNum, toPageNum);
    if (success) {
      const pdfBytes = await window.pdfEditor.save();
      await this.reloadPDF(pdfBytes);
    }
  }

  async mergePDF() {
    try {
      const files = await window.electronAPI.openFiles();
      if (!files || files.length === 0) return;

      const buffers = files.map(f => f.buffer);
      const success = await window.pdfEditor.mergePDFs(buffers);

      if (success) {
        const pdfBytes = await window.pdfEditor.save();
        await this.reloadPDF(pdfBytes);
        this.showToast(window.i18n.t('pdfMerged'), 'success');
      }
    } catch (error) {
      console.error('Failed to merge PDFs:', error);
      this.showToast(window.i18n.t('error'), 'error');
    }
  }

  async reloadPDF(pdfBytes) {
    const currentPage = Math.min(
      window.pageManager.getCurrentPage(),
      window.pdfEditor.getPageCount()
    );

    // Copy buffer because PDF.js transfers it to the worker
    const bytesForEditor = pdfBytes.slice(0);

    await window.pdfRenderer.loadPDF(pdfBytes);
    await window.pdfEditor.loadPDF(bytesForEditor, this.currentFilePath);

    // Sync updated document references into the active tab
    const tab = window.tabManager.getActiveTab();
    if (tab) {
      tab.pdfJsDoc = window.pdfRenderer.pdfDoc;
      tab.pdfLibDoc = window.pdfEditor.pdfDoc;
      tab.originalBuffer = window.pdfEditor.originalBuffer;
      tab.totalPages = window.pdfRenderer.totalPages;
    }

    await window.pdfRenderer.renderPage(currentPage);
    await window.pageManager.renderThumbnails();

    await this.fitWidth();
  }

  setActiveTool(tool) {
    window.uiController.setActiveTool(tool);
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Initialize app - called from index.html after all scripts are loaded
async function initApp() {
  console.log('[App] Initializing PDFedit...');
  window.app = new App();
  await window.app.init();
  console.log('[App] PDFedit initialized successfully');
}

// Export for testing; auto-init only in browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = App;
} else if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
