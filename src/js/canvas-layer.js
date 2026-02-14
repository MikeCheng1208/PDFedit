/**
 * Canvas Layer Module
 * Handles Fabric.js drawing layer overlay on PDF
 */

class CanvasLayer {
  constructor() {
    this.fabricCanvas = null;
    this.container = null;
    this.currentTool = 'select';
    this.currentColor = '#E07A2F';
    this.strokeWidth = 2;
    this.fontSize = 16;
    this.fontFamily = 'Arial, sans-serif';
    this.fontBold = false;
    this.isDrawing = false;
    this.drawingShape = 'freehand';
    this.startPoint = null;
    this.activeShape = null;

    // Store annotations per page
    this.pageAnnotations = {};
    this.currentPage = 1;

    // Toolbar interaction state
    this._toolbarInteracting = false;
    this._editingTextObj = null;
  }

  init(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error('Container not found:', containerId);
      return;
    }

    // Create canvas element
    const canvasEl = document.createElement('canvas');
    canvasEl.id = 'fabric-canvas';
    this.container.innerHTML = '';
    this.container.appendChild(canvasEl);

    // Initialize Fabric.js canvas
    this.fabricCanvas = new fabric.Canvas('fabric-canvas', {
      isDrawingMode: false,
      selection: true,
      preserveObjectStacking: true
    });

    this.setupEvents();
    this.setupTextToolbar();
  }

  setupEvents() {
    // Mouse events for shape drawing
    this.fabricCanvas.on('mouse:down', (e) => this.onMouseDown(e));
    this.fabricCanvas.on('mouse:move', (e) => this.onMouseMove(e));
    this.fabricCanvas.on('mouse:up', (e) => this.onMouseUp(e));

    // Object selection events
    this.fabricCanvas.on('selection:created', (e) => {
      if (this.currentTool === 'eraser') {
        this.deleteSelected();
      }
    });

    // Notify tab manager when canvas objects change
    this.fabricCanvas.on('object:added', () => {
      window.tabManager?.markModified();
    });
    this.fabricCanvas.on('object:removed', () => {
      window.tabManager?.markModified();
    });
    this.fabricCanvas.on('object:modified', () => {
      window.tabManager?.markModified();
    });

    // Reposition floating toolbar when text object is moved
    this.fabricCanvas.on('object:moving', (e) => {
      const obj = e.target;
      if (obj && obj.type === 'i-text' && obj.isEditing) {
        this._positionTextToolbar(obj);
      }
    });

    // Show floating toolbar when text editing starts, keep controls visible
    this.fabricCanvas.on('text:editing:entered', (e) => {
      const textObj = e.target;
      if (textObj) {
        this._editingTextObj = textObj;
        // Override Fabric's default: keep resize handles and allow moving during editing
        textObj.hasControls = true;
        textObj.selectable = true;
        textObj.lockMovementX = false;
        textObj.lockMovementY = false;
        this.fabricCanvas.renderAll();
        this.showTextToolbar(textObj);
      }
    });

    // Hide toolbar and clean up when text editing ends
    this.fabricCanvas.on('text:editing:exited', (e) => {
      // Toolbar interaction in progress — don't hide or clean up
      if (this._toolbarInteracting) {
        return;
      }

      const textObj = e.target;
      if (textObj && textObj.text.trim() === '') {
        this.fabricCanvas.remove(textObj);
      }
      this.fabricCanvas.renderAll();
      this.hideTextToolbar();

      // Auto-switch to select tool so user can move/resize the text
      if (this.currentTool === 'text') {
        this.currentTool = 'select';
        this.fabricCanvas.defaultCursor = 'default';
        this.fabricCanvas.hoverCursor = 'move';
        window.uiController?.setActiveTool('select');
      }
    });

    // Listen for page render events
    window.addEventListener('pageRendered', (e) => {
      this.resize(e.detail.width, e.detail.height);
    });
  }

  setupTextToolbar() {
    const toolbar = document.getElementById('text-toolbar');
    if (!toolbar) return;

    // Bold button — use mousedown + preventDefault to keep IText focus
    const boldBtn = document.getElementById('text-toolbar-bold');
    boldBtn?.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.fontBold = !this.fontBold;
      boldBtn.classList.toggle('active', this.fontBold);
      const activeObj = this.fabricCanvas.getActiveObject();
      if (activeObj && activeObj.type === 'i-text') {
        activeObj.set('fontWeight', this.fontBold ? 'bold' : 'normal');
        activeObj.initDimensions();
        activeObj.setCoords();
        this.fabricCanvas.renderAll();
        this._positionTextToolbar(activeObj);
      }
    });

    // Font size input — allow native focus, set _toolbarInteracting flag
    const sizeInput = document.getElementById('text-toolbar-size');
    sizeInput?.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this._toolbarInteracting = true;
    });
    sizeInput?.addEventListener('input', () => {
      const size = parseInt(sizeInput.value);
      if (size >= 8 && size <= 200) {
        this.fontSize = size;
        if (this._editingTextObj) {
          this._editingTextObj.set('fontSize', size);
          this._editingTextObj.initDimensions();
          this._editingTextObj.setCoords();
          this.fabricCanvas.renderAll();
          this._positionTextToolbar(this._editingTextObj);
        }
      }
    });
    sizeInput?.addEventListener('change', () => {
      this._refocusTextEditing();
    });
    sizeInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._refocusTextEditing();
      }
    });

    // Font family select — allow native focus to open dropdown
    const fontSelect = document.getElementById('text-toolbar-font');
    fontSelect?.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this._toolbarInteracting = true;
    });
    fontSelect?.addEventListener('change', () => {
      this.fontFamily = fontSelect.value;
      if (this._editingTextObj) {
        this._editingTextObj.set('fontFamily', this.fontFamily);
        this._editingTextObj.initDimensions();
        this._editingTextObj.setCoords();
        this.fabricCanvas.renderAll();
        this._positionTextToolbar(this._editingTextObj);
      }
      this._refocusTextEditing();
    });

    // Text color picker — native color dialog, preventDefault to keep IText focus
    const colorInput = document.getElementById('text-toolbar-color');
    const colorPreview = document.getElementById('text-toolbar-color-preview');
    colorInput?.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this._toolbarInteracting = true;
    });
    colorInput?.addEventListener('input', () => {
      const color = colorInput.value;
      if (colorPreview) colorPreview.style.backgroundColor = color;
      this.currentColor = color;
      if (this._editingTextObj) {
        this._editingTextObj.set('fill', color);
        this.fabricCanvas.renderAll();
      }
    });
    colorInput?.addEventListener('change', () => {
      this._refocusTextEditing();
    });

    // Prevent non-interactive toolbar areas from stealing focus
    toolbar.addEventListener('mousedown', (e) => {
      if (e.target === toolbar || e.target.classList.contains('text-toolbar-inner')
          || e.target.classList.contains('text-toolbar-separator')
          || e.target.classList.contains('text-toolbar-fontsize')) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
  }

  showTextToolbar(textObj) {
    const toolbar = document.getElementById('text-toolbar');
    if (!toolbar) return;
    toolbar.style.display = 'block';
    this._updateTextToolbarValues(textObj);
    this._positionTextToolbar(textObj);
  }

  hideTextToolbar() {
    const toolbar = document.getElementById('text-toolbar');
    if (toolbar) toolbar.style.display = 'none';
  }

  _refocusTextEditing() {
    this._toolbarInteracting = false;
    const textObj = this._editingTextObj;
    if (textObj && this.fabricCanvas.getObjects().includes(textObj)) {
      this.fabricCanvas.setActiveObject(textObj);
      textObj.enterEditing();
      this.fabricCanvas.renderAll();
    }
  }

  _positionTextToolbar(textObj) {
    const toolbar = document.getElementById('text-toolbar');
    if (!toolbar || toolbar.style.display === 'none') return;

    const rect = textObj.getBoundingRect();
    const gap = 8;
    let left = rect.left;
    let top = rect.top - toolbar.offsetHeight - gap;

    // Keep within canvas bounds
    if (top < 0) top = rect.top + rect.height + gap;
    if (left < 0) left = 0;
    const maxLeft = this.fabricCanvas.width - toolbar.offsetWidth;
    if (left > maxLeft) left = Math.max(0, maxLeft);

    toolbar.style.left = left + 'px';
    toolbar.style.top = top + 'px';
  }

  _updateTextToolbarValues(textObj) {
    const sizeInput = document.getElementById('text-toolbar-size');
    const fontSelect = document.getElementById('text-toolbar-font');
    const boldBtn = document.getElementById('text-toolbar-bold');

    if (sizeInput) sizeInput.value = textObj.fontSize || 16;
    if (fontSelect) {
      // Try to match option value
      const family = textObj.fontFamily || 'Arial, sans-serif';
      fontSelect.value = family;
      // If no match, select first option
      if (fontSelect.selectedIndex === -1) fontSelect.selectedIndex = 0;
    }
    if (boldBtn) {
      const isBold = textObj.fontWeight === 'bold';
      boldBtn.classList.toggle('active', isBold);
      this.fontBold = isBold;
    }

    const colorInput = document.getElementById('text-toolbar-color');
    const colorPreview = document.getElementById('text-toolbar-color-preview');
    const fill = textObj.fill || this.currentColor;
    if (colorInput) colorInput.value = fill;
    if (colorPreview) colorPreview.style.backgroundColor = fill;
  }

  resize(width, height) {
    if (!this.fabricCanvas) return;

    this.fabricCanvas.setWidth(width);
    this.fabricCanvas.setHeight(height);
    this.fabricCanvas.renderAll();
  }

  setTool(tool) {
    this.currentTool = tool;

    // Configure canvas based on tool
    switch (tool) {
      case 'select':
        this.fabricCanvas.isDrawingMode = false;
        this.fabricCanvas.selection = true;
        this.fabricCanvas.defaultCursor = 'default';
        this.fabricCanvas.hoverCursor = 'move';
        this.fabricCanvas.forEachObject(obj => obj.selectable = true);
        break;

      case 'draw':
        this.fabricCanvas.isDrawingMode = true;
        this.fabricCanvas.freeDrawingBrush.color = this.currentColor;
        this.fabricCanvas.freeDrawingBrush.width = this.strokeWidth;
        break;

      case 'highlight':
        this.fabricCanvas.isDrawingMode = true;
        this.fabricCanvas.freeDrawingBrush.color = this.hexToRgba(this.currentColor, 0.4);
        this.fabricCanvas.freeDrawingBrush.width = 20;
        break;

      case 'eraser':
        this.fabricCanvas.isDrawingMode = false;
        this.fabricCanvas.selection = true;
        this.fabricCanvas.defaultCursor = 'default';
        this.fabricCanvas.hoverCursor = 'move';
        this.fabricCanvas.forEachObject(obj => obj.selectable = true);
        break;

      case 'text':
        this.fabricCanvas.isDrawingMode = false;
        this.fabricCanvas.selection = true;
        this.fabricCanvas.forEachObject(obj => obj.selectable = true);
        this.fabricCanvas.defaultCursor = 'text';
        this.fabricCanvas.hoverCursor = 'move';
        break;

      case 'image':
      case 'signature':
        this.fabricCanvas.isDrawingMode = false;
        this.fabricCanvas.selection = false;
        this.fabricCanvas.forEachObject(obj => obj.selectable = false);
        break;
    }
  }

  setDrawingShape(shape) {
    this.drawingShape = shape;
    if (shape === 'freehand') {
      this.fabricCanvas.isDrawingMode = true;
      this.fabricCanvas.freeDrawingBrush.color = this.currentColor;
      this.fabricCanvas.freeDrawingBrush.width = this.strokeWidth;
    } else {
      this.fabricCanvas.isDrawingMode = false;
    }
  }

  _createITextStyle() {
    return {
      fontSize: this.fontSize,
      fill: this.currentColor,
      fontFamily: this.fontFamily,
      fontWeight: this.fontBold ? 'bold' : 'normal',
      cursorColor: this.currentColor,
      selectionColor: 'rgba(55, 130, 250, 0.3)',
      // Light blue selection frame with visible resize handles
      borderColor: 'rgba(55, 130, 250, 0.85)',
      editingBorderColor: 'rgba(55, 130, 250, 0.85)',
      cornerColor: 'rgba(55, 130, 250, 0.9)',
      cornerStrokeColor: 'rgba(55, 130, 250, 1)',
      cornerSize: 10,
      cornerStyle: 'circle',
      transparentCorners: false,
      padding: 4,
      borderScaleFactor: 1.5
    };
  }

  onMouseDown(e) {
    // Handle text tool: create IText at click position
    if (this.currentTool === 'text') {
      // If clicking on an existing IText, let Fabric handle editing
      if (e.target && e.target.type === 'i-text') return;

      const pointer = this.fabricCanvas.getPointer(e.e);

      const textObj = new fabric.IText('', {
        left: pointer.x,
        top: pointer.y,
        ...this._createITextStyle()
      });

      this.fabricCanvas.add(textObj);
      this.fabricCanvas.setActiveObject(textObj);
      textObj.enterEditing();
      this.fabricCanvas.renderAll();
      return;
    }

    if (this.currentTool !== 'draw' || this.drawingShape === 'freehand') return;

    this.isDrawing = true;
    const pointer = this.fabricCanvas.getPointer(e.e);
    this.startPoint = { x: pointer.x, y: pointer.y };

    // Create shape based on type
    switch (this.drawingShape) {
      case 'line':
        this.activeShape = new fabric.Line(
          [pointer.x, pointer.y, pointer.x, pointer.y],
          {
            stroke: this.currentColor,
            strokeWidth: this.strokeWidth,
            selectable: true
          }
        );
        break;

      case 'rectangle':
        this.activeShape = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          fill: 'transparent',
          stroke: this.currentColor,
          strokeWidth: this.strokeWidth,
          selectable: true
        });
        break;

      case 'circle':
        this.activeShape = new fabric.Ellipse({
          left: pointer.x,
          top: pointer.y,
          rx: 0,
          ry: 0,
          fill: 'transparent',
          stroke: this.currentColor,
          strokeWidth: this.strokeWidth,
          selectable: true
        });
        break;

      case 'arrow':
        this.activeShape = this.createArrow(pointer.x, pointer.y, pointer.x, pointer.y);
        break;
    }

    if (this.activeShape) {
      this.fabricCanvas.add(this.activeShape);
    }
  }

  onMouseMove(e) {
    if (!this.isDrawing || !this.activeShape) return;

    const pointer = this.fabricCanvas.getPointer(e.e);

    switch (this.drawingShape) {
      case 'line':
        this.activeShape.set({ x2: pointer.x, y2: pointer.y });
        break;

      case 'rectangle':
        const width = pointer.x - this.startPoint.x;
        const height = pointer.y - this.startPoint.y;

        this.activeShape.set({
          left: width > 0 ? this.startPoint.x : pointer.x,
          top: height > 0 ? this.startPoint.y : pointer.y,
          width: Math.abs(width),
          height: Math.abs(height)
        });
        break;

      case 'circle':
        const rx = Math.abs(pointer.x - this.startPoint.x) / 2;
        const ry = Math.abs(pointer.y - this.startPoint.y) / 2;

        this.activeShape.set({
          left: Math.min(this.startPoint.x, pointer.x),
          top: Math.min(this.startPoint.y, pointer.y),
          rx: rx,
          ry: ry
        });
        break;

      case 'arrow':
        this.fabricCanvas.remove(this.activeShape);
        this.activeShape = this.createArrow(
          this.startPoint.x, this.startPoint.y,
          pointer.x, pointer.y
        );
        this.fabricCanvas.add(this.activeShape);
        break;
    }

    this.activeShape.setCoords();
    this.fabricCanvas.renderAll();
  }

  onMouseUp(e) {
    this.isDrawing = false;
    this.activeShape = null;
  }

  createArrow(x1, y1, x2, y2) {
    const headLength = 15;
    const angle = Math.atan2(y2 - y1, x2 - x1);

    const line = new fabric.Line([x1, y1, x2, y2], {
      stroke: this.currentColor,
      strokeWidth: this.strokeWidth
    });

    const head = new fabric.Triangle({
      left: x2,
      top: y2,
      originX: 'center',
      originY: 'center',
      angle: (angle * 180 / Math.PI) + 90,
      width: headLength,
      height: headLength,
      fill: this.currentColor
    });

    return new fabric.Group([line, head], {
      selectable: true
    });
  }

  setColor(color) {
    this.currentColor = color;
    if (this.fabricCanvas.freeDrawingBrush) {
      if (this.currentTool === 'highlight') {
        this.fabricCanvas.freeDrawingBrush.color = this.hexToRgba(color, 0.4);
      } else {
        this.fabricCanvas.freeDrawingBrush.color = color;
      }
    }

    // Update the currently active/selected text object
    const activeObj = this.fabricCanvas.getActiveObject();
    if (activeObj && activeObj.type === 'i-text') {
      activeObj.set('fill', color);
      this.fabricCanvas.renderAll();
    }
  }

  setStrokeWidth(width) {
    this.strokeWidth = parseInt(width);
    if (this.fabricCanvas.freeDrawingBrush) {
      this.fabricCanvas.freeDrawingBrush.width = this.strokeWidth;
    }
  }

  setFontSize(size) {
    this.fontSize = parseInt(size);

    // Update the currently active/selected text object
    const activeObj = this.fabricCanvas.getActiveObject();
    if (activeObj && activeObj.type === 'i-text') {
      activeObj.set('fontSize', this.fontSize);
      activeObj.initDimensions();
      activeObj.setCoords();
      this.fabricCanvas.renderAll();
    }
  }

  setFontFamily(family) {
    this.fontFamily = family;

    const activeObj = this.fabricCanvas.getActiveObject();
    if (activeObj && activeObj.type === 'i-text') {
      activeObj.set('fontFamily', family);
      activeObj.initDimensions();
      activeObj.setCoords();
      this.fabricCanvas.renderAll();
    }
  }

  setBold(bold) {
    this.fontBold = bold;

    const activeObj = this.fabricCanvas.getActiveObject();
    if (activeObj && activeObj.type === 'i-text') {
      activeObj.set('fontWeight', bold ? 'bold' : 'normal');
      activeObj.initDimensions();
      activeObj.setCoords();
      this.fabricCanvas.renderAll();
    }
  }

  getVisibleCenter() {
    const viewer = document.getElementById('viewer-container');
    if (!viewer) {
      return { x: this.fabricCanvas.width / 2, y: this.fabricCanvas.height / 2 };
    }
    const canvasContainer = document.getElementById('pdf-canvas-container');
    const rect = canvasContainer.getBoundingClientRect();
    const viewerRect = viewer.getBoundingClientRect();

    // Calculate visible area center relative to the canvas
    const centerX = (viewerRect.left + viewerRect.width / 2 - rect.left);
    const centerY = (viewerRect.top + viewerRect.height / 2 - rect.top);

    // Clamp to canvas bounds
    return {
      x: Math.max(0, Math.min(this.fabricCanvas.width, centerX)),
      y: Math.max(0, Math.min(this.fabricCanvas.height, centerY))
    };
  }

  addText(text, x, y) {
    if (!text) return;

    const center = this.getVisibleCenter();
    const textObj = new fabric.IText(text, {
      left: x || center.x,
      top: y || center.y,
      originX: 'center',
      originY: 'center',
      ...this._createITextStyle()
    });

    this.fabricCanvas.add(textObj);
    this.fabricCanvas.setActiveObject(textObj);
    this.fabricCanvas.renderAll();

    return textObj;
  }

  addImage(dataUrl, x, y, callback) {
    fabric.Image.fromURL(dataUrl, (img) => {
      // Scale image to reasonable size
      const maxSize = 300;
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);

      const center = this.getVisibleCenter();
      img.set({
        left: x || center.x,
        top: y || center.y,
        originX: 'center',
        originY: 'center',
        scaleX: scale,
        scaleY: scale
      });

      this.fabricCanvas.add(img);
      this.fabricCanvas.setActiveObject(img);
      this.fabricCanvas.renderAll();

      if (callback) callback(img);
    });
  }

  addSignature(dataUrl, x, y) {
    return new Promise((resolve) => {
      fabric.Image.fromURL(dataUrl, (img) => {
        // Scale signature to reasonable size
        const maxWidth = 200;
        const scale = Math.min(maxWidth / img.width, 1);

        const center = this.getVisibleCenter();
        img.set({
          left: x || center.x,
          top: y || center.y,
          originX: 'center',
          originY: 'center',
          scaleX: scale,
          scaleY: scale
        });

        this.fabricCanvas.add(img);
        this.fabricCanvas.setActiveObject(img);
        this.fabricCanvas.renderAll();

        resolve(img);
      });
    });
  }

  deleteSelected() {
    const activeObjects = this.fabricCanvas.getActiveObjects();
    if (activeObjects.length > 0) {
      activeObjects.forEach(obj => {
        this.fabricCanvas.remove(obj);
      });
      this.fabricCanvas.discardActiveObject();
      this.fabricCanvas.renderAll();
    }
  }

  clearAll() {
    this.fabricCanvas.clear();
  }

  // Save annotations for current page
  savePageAnnotations(pageNum) {
    const json = this.fabricCanvas.toJSON();
    this.pageAnnotations[pageNum] = json;
  }

  // Load annotations for a page
  loadPageAnnotations(pageNum) {
    this.fabricCanvas.clear();
    this.currentPage = pageNum;

    const annotations = this.pageAnnotations[pageNum];
    if (annotations) {
      this.fabricCanvas.loadFromJSON(annotations, () => {
        this.fabricCanvas.renderAll();
      });
    }
  }

  // Get all annotations data
  getAllAnnotations() {
    // Save current page first
    this.savePageAnnotations(this.currentPage);
    return this.pageAnnotations;
  }

  // Set all annotations data
  setAllAnnotations(annotations) {
    this.pageAnnotations = annotations || {};
  }

  // Export canvas to image
  toDataURL(options = {}) {
    return this.fabricCanvas.toDataURL({
      format: 'png',
      quality: 1,
      ...options
    });
  }

  // Helper to convert hex to rgba
  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  getCanvas() {
    return this.fabricCanvas;
  }

  hasAnnotations(pageNum) {
    const annotations = this.pageAnnotations[pageNum];
    return annotations && annotations.objects && annotations.objects.length > 0;
  }
}

// Create global instance or export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CanvasLayer;
} else {
  window.canvasLayer = new CanvasLayer();
}
