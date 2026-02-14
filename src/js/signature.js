/**
 * Signature Module
 * Handles electronic signature creation, upload, and management
 */

class SignatureManager {
  constructor() {
    this.signatureCanvas = null;
    this.ctx = null;
    this.isDrawing = false;
    this.lastPoint = null;
    this.savedSignatures = [];
    this.selectedSignature = null;
    this.uploadedImage = null;
    this.signatureColor = '#2D2D2D';
    this.signatureStrokeWidth = 2;
    this.strokes = [];
    this.currentStroke = null;
  }

  init() {
    this.signatureCanvas = document.getElementById('signature-canvas');
    if (!this.signatureCanvas) return;

    this.ctx = this.signatureCanvas.getContext('2d');
    this.resizeCanvas();
    this.setupEvents();
    this.loadSavedSignatures();
  }

  resizeCanvas() {
    const container = this.signatureCanvas.parentElement;
    const rect = container.getBoundingClientRect();

    // Set canvas size
    this.signatureCanvas.width = rect.width - 40; // Account for padding
    this.signatureCanvas.height = 200;

    // Clear and set styles
    this.clearCanvas();
  }

  setupEvents() {
    // Drawing events
    this.signatureCanvas.addEventListener('mousedown', (e) => this.startDrawing(e));
    this.signatureCanvas.addEventListener('mousemove', (e) => this.draw(e));
    this.signatureCanvas.addEventListener('mouseup', () => this.stopDrawing());
    this.signatureCanvas.addEventListener('mouseleave', () => this.stopDrawing());

    // Touch support
    this.signatureCanvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this.startDrawing(touch);
    });
    this.signatureCanvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this.draw(touch);
    });
    this.signatureCanvas.addEventListener('touchend', () => this.stopDrawing());

    // Upload area events
    const uploadArea = document.getElementById('upload-area');
    if (uploadArea) {
      uploadArea.addEventListener('click', () => this.selectImage());
      uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
      });
      uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
      });
      uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
          this.handleImageFile(file);
        }
      });
    }

    // Tab switching
    document.querySelectorAll('.signature-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    // Signature color picker
    const sigColorInput = document.getElementById('signature-color');
    const sigColorPreview = document.getElementById('signature-color-preview');
    sigColorInput?.addEventListener('input', (e) => {
      this.signatureColor = e.target.value;
      if (sigColorPreview) sigColorPreview.style.backgroundColor = e.target.value;
      this.redrawStrokes();
    });

    // Signature stroke width
    const sigStrokeInput = document.getElementById('signature-stroke-width');
    const sigStrokeLabel = document.getElementById('signature-stroke-label');
    sigStrokeInput?.addEventListener('input', (e) => {
      this.signatureStrokeWidth = parseInt(e.target.value);
      if (sigStrokeLabel) sigStrokeLabel.textContent = `${e.target.value}px`;
      this.redrawStrokes();
    });

    // Button events
    document.getElementById('btn-clear-signature')?.addEventListener('click', () => this.clearCanvas());
    document.getElementById('btn-save-signature')?.addEventListener('click', () => this.saveCurrentSignature());
    document.getElementById('btn-use-signature')?.addEventListener('click', () => this.useDrawnSignature());
    document.getElementById('btn-select-image')?.addEventListener('click', () => this.selectImage());
    document.getElementById('btn-use-uploaded')?.addEventListener('click', () => this.useUploadedSignature());
    document.getElementById('btn-close-signature')?.addEventListener('click', () => this.close());
  }

  startDrawing(e) {
    this.isDrawing = true;
    this.lastPoint = this.getPoint(e);
    this.currentStroke = [this.lastPoint];
  }

  draw(e) {
    if (!this.isDrawing) return;

    const point = this.getPoint(e);
    this.currentStroke.push(point);

    this.ctx.beginPath();
    this.ctx.strokeStyle = this.signatureColor;
    this.ctx.lineWidth = this.signatureStrokeWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.moveTo(this.lastPoint.x, this.lastPoint.y);
    this.ctx.lineTo(point.x, point.y);
    this.ctx.stroke();

    this.lastPoint = point;
  }

  stopDrawing() {
    if (this.currentStroke && this.currentStroke.length > 1) {
      this.strokes.push(this.currentStroke);
    }
    this.isDrawing = false;
    this.lastPoint = null;
    this.currentStroke = null;
  }

  redrawStrokes() {
    this._clearCanvasPixels();
    if (!this.strokes.length) return;

    this.ctx.strokeStyle = this.signatureColor;
    this.ctx.lineWidth = this.signatureStrokeWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    for (const stroke of this.strokes) {
      this.ctx.beginPath();
      this.ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        this.ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      this.ctx.stroke();
    }
  }

  getPoint(e) {
    const rect = this.signatureCanvas.getBoundingClientRect();
    return {
      x: (e.clientX || e.pageX) - rect.left,
      y: (e.clientY || e.pageY) - rect.top
    };
  }

  _clearCanvasPixels() {
    if (!this.ctx) return;
    this.ctx.fillStyle = window.themeManager?.isDark() ? '#1A1A1E' : '#FEFBF6';
    this.ctx.fillRect(0, 0, this.signatureCanvas.width, this.signatureCanvas.height);
  }

  clearCanvas() {
    this.strokes = [];
    this.currentStroke = null;
    this._clearCanvasPixels();
  }

  isCanvasEmpty() {
    const imageData = this.ctx.getImageData(0, 0, this.signatureCanvas.width, this.signatureCanvas.height);
    const data = imageData.data;

    // Check if all pixels are background color
    const bgColor = window.themeManager?.isDark() ? [26, 26, 30] : [254, 251, 246];

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Allow some tolerance
      if (Math.abs(r - bgColor[0]) > 10 ||
          Math.abs(g - bgColor[1]) > 10 ||
          Math.abs(b - bgColor[2]) > 10) {
        return false;
      }
    }
    return true;
  }

  getSignatureDataUrl() {
    if (this.isCanvasEmpty()) return null;

    // Create a temporary canvas to get trimmed signature with transparent background
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    // Get image data
    const imageData = this.ctx.getImageData(0, 0, this.signatureCanvas.width, this.signatureCanvas.height);
    const data = imageData.data;

    // Find bounds of the signature
    let minX = this.signatureCanvas.width;
    let minY = this.signatureCanvas.height;
    let maxX = 0;
    let maxY = 0;

    const bgColor = window.themeManager?.isDark() ? [26, 26, 30] : [254, 251, 246];

    for (let y = 0; y < this.signatureCanvas.height; y++) {
      for (let x = 0; x < this.signatureCanvas.width; x++) {
        const i = (y * this.signatureCanvas.width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        if (Math.abs(r - bgColor[0]) > 10 ||
            Math.abs(g - bgColor[1]) > 10 ||
            Math.abs(b - bgColor[2]) > 10) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (maxX < minX || maxY < minY) return null;

    // Add padding
    const padding = 10;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(this.signatureCanvas.width, maxX + padding);
    maxY = Math.min(this.signatureCanvas.height, maxY + padding);

    const width = maxX - minX;
    const height = maxY - minY;

    tempCanvas.width = width;
    tempCanvas.height = height;

    // Draw cropped signature
    tempCtx.drawImage(
      this.signatureCanvas,
      minX, minY, width, height,
      0, 0, width, height
    );

    // Make background transparent
    const croppedData = tempCtx.getImageData(0, 0, width, height);
    const pixels = croppedData.data;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];

      if (Math.abs(r - bgColor[0]) <= 10 &&
          Math.abs(g - bgColor[1]) <= 10 &&
          Math.abs(b - bgColor[2]) <= 10) {
        pixels[i + 3] = 0; // Make transparent
      }
    }

    tempCtx.putImageData(croppedData, 0, 0);

    return tempCanvas.toDataURL('image/png');
  }

  async saveCurrentSignature() {
    const dataUrl = this.getSignatureDataUrl();
    if (!dataUrl) {
      window.app?.showToast(window.i18n.t('error'), 'error');
      return;
    }

    const id = Date.now().toString();

    try {
      await window.electronAPI.saveSignature({ id, dataUrl });
      this.savedSignatures.push({ id, dataUrl });
      this.renderSavedSignatures();
      this.clearCanvas();
      window.app?.showToast(window.i18n.t('signatureSaved'), 'success');
    } catch (error) {
      console.error('Failed to save signature:', error);
      window.app?.showToast(window.i18n.t('error'), 'error');
    }
  }

  async loadSavedSignatures() {
    try {
      this.savedSignatures = await window.electronAPI.loadAllSignatures();
      this.renderSavedSignatures();
    } catch (error) {
      console.error('Failed to load signatures:', error);
    }
  }

  renderSavedSignatures() {
    const container = document.getElementById('saved-signatures');
    if (!container) return;

    if (this.savedSignatures.length === 0) {
      container.innerHTML = `<div class="no-signatures" data-i18n="noSavedSignatures">${window.i18n.t('noSavedSignatures')}</div>`;
      return;
    }

    container.innerHTML = this.savedSignatures.map(sig => `
      <div class="saved-signature-item" data-id="${sig.id}">
        <img src="${sig.dataUrl}" alt="Signature">
        <button class="saved-signature-delete" data-id="${sig.id}">×</button>
      </div>
    `).join('');

    // Add click handlers
    container.querySelectorAll('.saved-signature-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('saved-signature-delete')) return;
        this.selectSavedSignature(item.dataset.id);
      });
    });

    container.querySelectorAll('.saved-signature-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteSavedSignature(btn.dataset.id);
      });
    });
  }

  selectSavedSignature(id) {
    const signature = this.savedSignatures.find(s => s.id === id);
    if (!signature) return;

    // Update selection UI
    document.querySelectorAll('.saved-signature-item').forEach(item => {
      item.classList.toggle('selected', item.dataset.id === id);
    });

    this.selectedSignature = signature;

    // Use this signature
    this.useSelectedSignature();
  }

  async deleteSavedSignature(id) {
    try {
      await window.electronAPI.deleteSignature(id);
      this.savedSignatures = this.savedSignatures.filter(s => s.id !== id);
      this.renderSavedSignatures();
      window.app?.showToast(window.i18n.t('signatureDeleted'), 'success');
    } catch (error) {
      console.error('Failed to delete signature:', error);
    }
  }

  async selectImage() {
    const result = await window.electronAPI.openImage();
    if (result) {
      this.handleImageDataUrl(result.dataUrl);
    }
  }

  handleImageFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.handleImageDataUrl(e.target.result);
    };
    reader.readAsDataURL(file);
  }

  handleImageDataUrl(dataUrl) {
    this.uploadedImage = dataUrl;

    const preview = document.getElementById('upload-preview');
    const placeholder = document.querySelector('.upload-placeholder');

    if (preview && placeholder) {
      preview.src = dataUrl;
      preview.style.display = 'block';
      placeholder.style.display = 'none';
    }

    document.getElementById('btn-use-uploaded').disabled = false;
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabName}`);
    });

    // Resize canvas when switching to draw tab
    if (tabName === 'draw') {
      setTimeout(() => this.resizeCanvas(), 100);
    }

    // Reload saved signatures when switching to saved tab
    if (tabName === 'saved') {
      this.loadSavedSignatures();
    }
  }

  useDrawnSignature() {
    const dataUrl = this.getSignatureDataUrl();
    if (!dataUrl) {
      window.app?.showToast(window.i18n.t('error'), 'error');
      return;
    }

    this.applySignature(dataUrl);
    this.close();
  }

  useUploadedSignature() {
    if (!this.uploadedImage) return;
    this.applySignature(this.uploadedImage);
    this.close();
  }

  useSelectedSignature() {
    if (!this.selectedSignature) return;
    this.applySignature(this.selectedSignature.dataUrl);
    this.close();
  }

  applySignature(dataUrl) {
    window.canvasLayer.addSignature(dataUrl);
    window.canvasLayer.setTool('select');
    window.app?.setActiveTool('select');
  }

  open() {
    const panel = document.getElementById('signature-panel');
    if (panel) {
      panel.style.display = 'block';

      // Set default color based on theme
      const defaultColor = window.themeManager?.isDark() ? '#E8E6E3' : '#2D2D2D';
      this.signatureColor = defaultColor;
      const sigColorInput = document.getElementById('signature-color');
      const sigColorPreview = document.getElementById('signature-color-preview');
      if (sigColorInput) sigColorInput.value = defaultColor;
      if (sigColorPreview) sigColorPreview.style.backgroundColor = defaultColor;

      this.resizeCanvas();
      this.clearCanvas();

      // Create backdrop
      const backdrop = document.createElement('div');
      backdrop.className = 'signature-backdrop';
      backdrop.id = 'signature-backdrop';
      backdrop.addEventListener('click', () => this.close());
      document.body.appendChild(backdrop);
    }
  }

  close() {
    const panel = document.getElementById('signature-panel');
    const backdrop = document.getElementById('signature-backdrop');

    if (panel) panel.style.display = 'none';
    if (backdrop) backdrop.remove();

    // Reset upload state
    this.uploadedImage = null;
    const preview = document.getElementById('upload-preview');
    const placeholder = document.querySelector('.upload-placeholder');
    if (preview) preview.style.display = 'none';
    if (placeholder) placeholder.style.display = 'block';
    document.getElementById('btn-use-uploaded').disabled = true;
  }

  isOpen() {
    const panel = document.getElementById('signature-panel');
    return panel && panel.style.display !== 'none';
  }
}

// Create global instance
window.signatureManager = new SignatureManager();
