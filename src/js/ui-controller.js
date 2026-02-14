/**
 * UI Controller Module
 * Handles UI interactions and state management
 */

class UIController {
  constructor() {
    this.activeTool = 'select';
    this.currentDrawShape = 'freehand';
    this.dropdownsOpen = {};
  }

  init() {
    this.setupToolbar();
    this.setupDropdowns();
    this.setupModals();
    this.setupColorPicker();
    this.setupSelects();
  }

  setupToolbar() {
    // Tool buttons
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tool = btn.dataset.tool;

        // Handle special tools
        if (tool === 'signature') {
          window.signatureManager.open();
          return;
        }

        if (tool === 'text') {
          this.setActiveTool('text');
          return;
        }

        if (tool === 'image') {
          this.handleImageTool();
          return;
        }

        this.setActiveTool(tool);
      });
    });

    // Draw shape buttons
    document.querySelectorAll('#draw-menu .dropdown-item').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentDrawShape = btn.dataset.shape;
        this.setActiveTool('draw');
      });
    });
  }

  setupDropdowns() {
    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.tool-dropdown')) {
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
          menu.style.display = 'none';
        });
      }
    });

    // Toggle dropdown on button click
    document.querySelectorAll('.tool-dropdown > .tool-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = btn.parentElement;
        const menu = dropdown.querySelector('.dropdown-menu');
        const isVisible = menu.style.display === 'block';

        // Close all other dropdowns
        document.querySelectorAll('.dropdown-menu').forEach(m => {
          m.style.display = 'none';
        });

        menu.style.display = isVisible ? 'none' : 'block';
      });
    });
  }

  setupModals() {
    // Text modal
    document.getElementById('btn-close-text-modal')?.addEventListener('click', () => {
      this.hideTextModal();
    });
    document.getElementById('btn-cancel-text')?.addEventListener('click', () => {
      this.hideTextModal();
    });
    document.getElementById('btn-add-text')?.addEventListener('click', () => {
      this.addTextFromModal();
    });

    // Split modal
    document.getElementById('btn-close-split-modal')?.addEventListener('click', () => {
      this.hideSplitModal();
    });
    document.getElementById('btn-cancel-split')?.addEventListener('click', () => {
      this.hideSplitModal();
    });
    document.getElementById('btn-confirm-split')?.addEventListener('click', () => {
      this.handleSplitPDF();
    });

    // Modal backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });
    });

    // Enter key in text modal
    document.getElementById('text-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.addTextFromModal();
      }
    });
  }

  setupColorPicker() {
    const colorPicker = document.getElementById('color-picker');
    const colorPreview = document.querySelector('.color-preview');

    colorPicker?.addEventListener('input', (e) => {
      const color = e.target.value;
      colorPreview.style.backgroundColor = color;
      window.canvasLayer.setColor(color);
    });
  }

  setupSelects() {
    document.getElementById('stroke-width')?.addEventListener('change', (e) => {
      window.canvasLayer.setStrokeWidth(e.target.value);
    });
  }

  setActiveTool(tool) {
    this.activeTool = tool;

    // Update UI
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });

    // Update canvas layer
    window.canvasLayer.setTool(tool);

    // Show/hide draw controls
    const drawControls = document.getElementById('draw-controls');
    if (drawControls) {
      drawControls.classList.toggle('visible', tool === 'draw');
    }

    // For draw tool, restore the remembered shape
    if (tool === 'draw') {
      window.canvasLayer.setDrawingShape(this.currentDrawShape);
      this.updateDrawShapeSelection(this.currentDrawShape);
    }
  }

  updateDrawShapeSelection(shape) {
    document.querySelectorAll('#draw-menu .dropdown-item').forEach(item => {
      item.classList.toggle('active', item.dataset.shape === shape);
    });
  }

  showTextModal() {
    const modal = document.getElementById('text-modal');
    const input = document.getElementById('text-input');
    modal.style.display = 'flex';
    input.value = '';
    input.focus();
  }

  hideTextModal() {
    document.getElementById('text-modal').style.display = 'none';
  }

  addTextFromModal() {
    const input = document.getElementById('text-input');
    const text = input.value.trim();

    if (text) {
      window.canvasLayer.addText(text);
      this.setActiveTool('select');
    }

    this.hideTextModal();
  }

  async handleImageTool() {
    const result = await window.electronAPI.openImage();
    if (result) {
      window.canvasLayer.addImage(result.dataUrl);
      this.setActiveTool('select');
    }
  }

  showSplitModal() {
    const modal = document.getElementById('split-modal');
    document.getElementById('split-range').value = '';
    modal.style.display = 'flex';
    document.getElementById('split-range').focus();
  }

  hideSplitModal() {
    document.getElementById('split-modal').style.display = 'none';
  }

  async handleSplitPDF() {
    const range = document.getElementById('split-range').value;
    if (!range) {
      window.app?.showToast(window.i18n.t('errorInvalidRange'), 'error');
      return;
    }

    const pdfBytes = await window.pdfEditor.splitPDF(range);
    if (!pdfBytes) {
      window.app?.showToast(window.i18n.t('errorInvalidRange'), 'error');
      return;
    }

    const result = await window.electronAPI.saveFile({
      buffer: pdfBytes,
      defaultPath: 'split.pdf'
    });

    if (result) {
      window.app?.showToast(window.i18n.t('pdfSplit'), 'success');
    }

    this.hideSplitModal();
  }

  showLoading() {
    document.getElementById('loading-overlay').style.display = 'flex';
  }

  hideLoading() {
    document.getElementById('loading-overlay').style.display = 'none';
  }

  showWelcome() {
    document.getElementById('welcome-screen').style.display = 'flex';
    document.getElementById('pdf-canvas-container').style.display = 'none';
  }

  hideWelcome() {
    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('pdf-canvas-container').style.display = 'block';
  }

  updateZoomLevel(scale) {
    document.getElementById('zoom-level').textContent = `${Math.round(scale * 100)}%`;
  }

  enableToolbar() {
    document.getElementById('btn-save').disabled = false;
    document.getElementById('btn-prev-page').disabled = false;
    document.getElementById('btn-next-page').disabled = false;
  }

  disableToolbar() {
    document.getElementById('btn-save').disabled = true;
    document.getElementById('btn-prev-page').disabled = true;
    document.getElementById('btn-next-page').disabled = true;
  }

  getActiveTool() {
    return this.activeTool;
  }
}

// Create global instance
window.uiController = new UIController();
